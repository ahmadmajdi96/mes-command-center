"""Generate isolated Supabase namespaces resources using upstream self-hosted v0.8.3 images.
Secrets are only emitted under .secrets/mes-supabase. No existing cloud project is modified.
"""
import pathlib,json,secrets,base64,hmac,hashlib,time,copy,subprocess,bcrypt
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=ROOT/'.local/supabase';OUT.mkdir(parents=True,exist_ok=True);OUT.chmod(0o700)
STATE=OUT/'credentials.json'
if STATE.exists():state=json.loads(STATE.read_text())
else:
 state={}
 for env in ['dev','staging','production']:
  def jwt(role,secret):
   enc=lambda v:base64.urlsafe_b64encode(json.dumps(v,separators=(',',':')).encode()).decode().rstrip('=')
   body=enc({'alg':'HS256','typ':'JWT'})+'.'+enc({'role':role,'iss':'supabase','iat':int(time.time()),'exp':int(time.time())+5*365*86400})
   return body+'.'+base64.urlsafe_b64encode(hmac.new(secret.encode(),body.encode(),hashlib.sha256).digest()).decode().rstrip('=')
  secret=secrets.token_hex(32);password=secrets.token_hex(24)
  state[env]={'JWT_SECRET':secret,'ANON_KEY':jwt('anon',secret),'SERVICE_ROLE_KEY':jwt('service_role',secret),'POSTGRES_PASSWORD':password,'SECRET_KEY_BASE':secrets.token_hex(64),'DB_ENC_KEY':secrets.token_hex(8),'PG_META_CRYPTO_KEY':secrets.token_hex(32),'STUDIO_PASSWORD':secrets.token_urlsafe(24),'ADMIN_PASSWORD':secrets.token_urlsafe(24)}
 STATE.write_text(json.dumps(state,indent=2));STATE.chmod(0o600)
ALL=[]
def obj(kind,name,ns,spec=None,api='v1',**kw):
 d={'apiVersion':api,'kind':kind,'metadata':{'name':name,'namespace':ns},**kw}
 if spec is not None:d['spec']=spec
 return d
def secenv(name,key=None):return {'name':name,'valueFrom':{'secretKeyRef':{'name':'mes-supabase','key':key or name}}}
def envs(d):return [{'name':k,'value':str(v)} for k,v in d.items()]
def secretrefs(mapping):return [secenv(k,v) for k,v in mapping.items()]
security={'allowPrivilegeEscalation':False,'capabilities':{'drop':['ALL']},'readOnlyRootFilesystem':True}
up=ROOT/'deploy/supabase/init'
for channel,ns,suffix,issuer in [('dev','development','apps.dev.cortanexai.com','namespace-dev'),('staging','staging','apps.staging.cortanexai.com','namespace-staging'),('production','manuqube','manuqube.com','namespace-prod-manuqube')]:
 o=[];creds=state[channel];hostname='mes.'+suffix;studio='mes-studio.manuqube.com' if channel=='production' else 'mes-studio.apps.'+('staging' if channel=='staging' else 'dev')+'.cortanexai.com';svc='mes-supabase.'+ns+'.svc.cluster.local';public='https://'+hostname+'/supabase'
 data={k:v for k,v in creds.items() if k not in ['ADMIN_PASSWORD','STUDIO_PASSWORD','TEST_PASSWORD']}
 data['STUDIO_HASH']=bcrypt.hashpw(creds['STUDIO_PASSWORD'].encode(),bcrypt.gensalt()).decode()
 o.append(obj('Secret','mes-supabase',ns,type='Opaque',stringData=data))
 o.append(obj('Certificate','mes-supabase-tls',ns,{'secretName':'mes-supabase-tls','duration':'2160h','renewBefore':'720h','issuerRef':{'name':issuer,'kind':'ClusterIssuer'},'dnsNames':[svc,studio]},api='cert-manager.io/v1'))
 for name,size in [('database','32Gi' if channel=='production' else '16Gi'),('storage','8Gi' if channel=='production' else '4Gi'),('backup','32Gi' if channel=='production' else '16Gi')]:
  o.append(obj('PersistentVolumeClaim','mes-supabase-'+name,ns,{'accessModes':['ReadWriteOnce'],'storageClassName':'longhorn','resources':{'requests':{'storage':size}}}))
 init={name:(up/name).read_text() for name in ['roles.sql','jwt.sql','realtime.sql','_supabase.sql','webhooks.sql']}
 o.append(obj('ConfigMap','mes-supabase-init',ns,data=init))
 gateway='''{
 admin localhost:2019
 auto_https off
}
(api) {
 @valid expression `{http.request.header.apikey} == "{$ANON_KEY}" || {http.request.header.apikey} == "{$SERVICE_ROLE_KEY}"`
 @realtime expression `{http.request.uri.query.apikey} == "{$ANON_KEY}" || {http.request.uri.query.apikey} == "{$SERVICE_ROLE_KEY}"`
 @authopen path /auth/v1/verify* /auth/v1/callback* /auth/v1/authorize* /auth/v1/.well-known/*
 handle @authopen {
  uri strip_prefix /auth/v1
  reverse_proxy 127.0.0.1:9999
 }
 handle @valid {
  handle_path /auth/v1/* { reverse_proxy 127.0.0.1:9999 }
  handle_path /rest/v1/* { reverse_proxy 127.0.0.1:3001 }
  handle_path /storage/v1/* { reverse_proxy 127.0.0.1:5000 }
  handle_path /realtime/v1/* {
   rewrite * /socket{uri}
   reverse_proxy 127.0.0.1:4000 { header_up Host realtime-dev.supabase-realtime }
  }
  respond "Not found" 404
 }
 handle @realtime {
  handle_path /realtime/v1/* {
   rewrite * /socket{uri}
   reverse_proxy 127.0.0.1:4000 { header_up Host realtime-dev.supabase-realtime }
  }
  respond "Not found" 404
 }
 handle /health { respond "ok" 200 }
 handle { respond "Valid API key required" 401 }
}
http://127.0.0.1:8000 { import api }
https://:8443 {
 tls /certs/tls.crt /certs/tls.key
 header Strict-Transport-Security "max-age=31536000"
 @studio host STUDIO_HOST
 handle @studio {
  basic_auth { admin {$STUDIO_HASH} }
  reverse_proxy 127.0.0.1:3000
 }
 handle { import api }
 handle_errors {
  @pausedAdmin host STUDIO_HOST
  handle @pausedAdmin {
   respond "Database administration is paused. Ask your administrator to enable it temporarily." 503
  }
  handle {
   respond "{err.status_text}" {err.status_code}
  }
 }
}
'''.replace('STUDIO_HOST',studio)
 # Expand inline blocks for Caddy's directive grammar.
 gateway=gateway.replace(' { reverse_proxy 127.0.0.1:9999 }',' {\n reverse_proxy 127.0.0.1:9999\n }').replace(' { reverse_proxy 127.0.0.1:3001 }',' {\n reverse_proxy 127.0.0.1:3001\n }').replace(' { reverse_proxy 127.0.0.1:5000 }',' {\n reverse_proxy 127.0.0.1:5000\n }').replace(' { header_up Host realtime-dev.supabase-realtime }',' {\n header_up Host realtime-dev.supabase-realtime\n }').replace('handle /health { respond "ok" 200 }','handle /health {\n respond "ok" 200\n }').replace('handle { respond "Valid API key required" 401 }','handle {\n respond "Valid API key required" 401\n }').replace('http://127.0.0.1:8000 { import api }','http://127.0.0.1:8000 {\n import api\n}').replace('basic_auth { admin {$STUDIO_HASH} }','basic_auth {\n admin {$STUDIO_HASH}\n }').replace('handle { import api }','handle {\n import api\n }')
 o.append(obj('ConfigMap','mes-supabase-gateway',ns,data={'Caddyfile':gateway}))
 def container(name,image,env,mem,req='64Mi',cpu='250m',mounts=[],**kwargs):
  return {'name':name,'image':image,'env':envs(env),'resources':{'requests':{'cpu':'25m','memory':req},'limits':{'cpu':cpu,'memory':mem}},'securityContext':copy.deepcopy(security),'volumeMounts':mounts,**kwargs}
 def mount(n,p,sub=None,ro=False):
  d={'name':n,'mountPath':p,'readOnly':ro}
  if sub:d['subPath']=sub
  return d
 db=container('db','supabase/postgres:17.6.1.136',{'POSTGRES_HOST':'/var/run/postgresql','PGPORT':'5432','POSTGRES_PORT':'5432','POSTGRES_USER':'supabase_admin','POSTGRES_DB':'postgres','PGDATABASE':'postgres','JWT_EXP':'3600','PGDATA':'/var/lib/postgresql/data/pgdata'},'1Gi','384Mi','1',mounts=[mount('database','/var/lib/postgresql/data','data'),mount('database','/etc/postgresql-custom','config'),mount('pg-run','/var/run/postgresql')],args=['postgres','-c','config_file=/etc/postgresql/postgresql.conf','-c','data_directory=/var/lib/postgresql/data/pgdata','-c','shared_buffers=128MB','-c','max_connections=120','-c','listen_addresses=127.0.0.1','-c','log_min_messages=warning'])
 db['env']+=secretrefs({'POSTGRES_PASSWORD':'POSTGRES_PASSWORD','PGPASSWORD':'POSTGRES_PASSWORD'});db['securityContext'].update({'runAsUser':100,'readOnlyRootFilesystem':False})
 for filename,target in [('webhooks.sql','init-scripts/98-webhooks.sql'),('roles.sql','init-scripts/99-roles.sql'),('jwt.sql','init-scripts/99-jwt.sql'),('realtime.sql','migrations/99-realtime.sql'),('_supabase.sql','migrations/97-_supabase.sql')]:db['volumeMounts'].append(mount('init','/docker-entrypoint-initdb.d/'+target,filename,True))
 db['startupProbe']={'exec':{'command':['pg_isready','-h','127.0.0.1','-U','supabase_admin']},'periodSeconds':10,'failureThreshold':90};db['readinessProbe']={'exec':{'command':['pg_isready','-h','127.0.0.1','-U','supabase_admin']},'periodSeconds':10}
 auth=container('auth','supabase/gotrue:v2.197.0',{'GOTRUE_API_HOST':'127.0.0.1','GOTRUE_API_PORT':'9999','API_EXTERNAL_URL':public+'/auth/v1','GOTRUE_DB_DRIVER':'postgres','GOTRUE_SITE_URL':'https://'+hostname,'GOTRUE_URI_ALLOW_LIST':'https://'+hostname+'/**','GOTRUE_DISABLE_SIGNUP':'true','GOTRUE_JWT_ADMIN_ROLES':'service_role','GOTRUE_JWT_AUD':'authenticated','GOTRUE_JWT_DEFAULT_GROUP_NAME':'authenticated','GOTRUE_JWT_EXP':'3600','GOTRUE_JWT_ISSUER':public+'/auth/v1','GOTRUE_EXTERNAL_EMAIL_ENABLED':'true','GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED':'false','GOTRUE_MAILER_AUTOCONFIRM':'false','GOTRUE_MAILER_URLPATHS_INVITE':'/auth/v1/verify','GOTRUE_MAILER_URLPATHS_CONFIRMATION':'/auth/v1/verify','GOTRUE_MAILER_URLPATHS_RECOVERY':'/auth/v1/verify','GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE':'/auth/v1/verify','GOTRUE_EXTERNAL_PHONE_ENABLED':'false'},'192Mi')
 auth['env']+=secretrefs({'GOTRUE_JWT_SECRET':'JWT_SECRET'})+[{'name':'GOTRUE_DB_DATABASE_URL','value':'postgres://supabase_auth_admin:'+creds['POSTGRES_PASSWORD']+'@127.0.0.1:5432/postgres?sslmode=disable'}]
 rest=container('rest','postgrest/postgrest:v14.18',{'PGRST_DB_URI':'postgres://authenticator:'+creds['POSTGRES_PASSWORD']+'@127.0.0.1:5432/postgres','PGRST_DB_SCHEMAS':'public,storage,graphql_public','PGRST_DB_ANON_ROLE':'anon','PGRST_SERVER_HOST':'127.0.0.1','PGRST_SERVER_PORT':'3001','PGRST_DB_USE_LEGACY_GUCS':'false','PGRST_DB_POOL':'10'},'192Mi');rest['env']+=secretrefs({'PGRST_JWT_SECRET':'JWT_SECRET'})
 realtime=container('realtime','supabase/realtime:v2.143.3',{'HOSTNAME':'realtime-dev.supabase-realtime','PORT':'4000','DB_HOST':'127.0.0.1','DB_PORT':'5432','DB_USER':'supabase_admin','DB_NAME':'postgres','DB_AFTER_CONNECT_QUERY':'SET search_path TO _realtime','ERL_AFLAGS':'-proto_dist inet_tcp','DNS_NODES':"''",'APP_NAME':'realtime','SEED_SELF_HOST':'true','RUN_JANITOR':'true','DISABLE_HEALTHCHECK_LOGGING':'true','DB_POOL_SIZE':'5','ERL_FLAGS':'+S 2:2'},'384Mi','96Mi',mounts=[mount('rt-tmp','/tmp')]);realtime['env']+=secretrefs({'DB_PASSWORD':'POSTGRES_PASSWORD','DB_ENC_KEY':'DB_ENC_KEY','API_JWT_SECRET':'JWT_SECRET','SECRET_KEY_BASE':'SECRET_KEY_BASE','METRICS_JWT_SECRET':'JWT_SECRET'})
 realtime['securityContext']['readOnlyRootFilesystem']=False
 storage=container('storage','supabase/storage-api:v1.81.0',{'PORT':'5000','HOST':'127.0.0.1','POSTGREST_URL':'http://127.0.0.1:3001','DATABASE_URL':'postgres://supabase_storage_admin:'+creds['POSTGRES_PASSWORD']+'@127.0.0.1:5432/postgres','FILE_SIZE_LIMIT':'52428800','STORAGE_BACKEND':'file','GLOBAL_S3_BUCKET':'mes','FILE_STORAGE_BACKEND_PATH':'/var/lib/storage','TENANT_ID':'mes','REGION':'local','ENABLE_IMAGE_TRANSFORMATION':'false','STORAGE_PUBLIC_URL':public,'REQUEST_ALLOW_X_FORWARDED_PATH':'true'},'256Mi',mounts=[mount('storage','/var/lib/storage'),mount('storage-tmp','/tmp')]);storage['env']+=secretrefs({'ANON_KEY':'ANON_KEY','SERVICE_KEY':'SERVICE_ROLE_KEY','AUTH_JWT_SECRET':'JWT_SECRET'})
 meta=container('meta','supabase/postgres-meta:v0.100.0',{'PG_META_PORT':'8080','PG_META_DB_HOST':'127.0.0.1','PG_META_DB_PORT':'5432','PG_META_DB_NAME':'postgres','PG_META_DB_USER':'postgres'},'192Mi');meta['env']+=secretrefs({'PG_META_DB_PASSWORD':'POSTGRES_PASSWORD','CRYPTO_KEY':'PG_META_CRYPTO_KEY'})
 studioct=container('studio','supabase/studio:2026.10.12-sha-3699278',{'HOSTNAME':'127.0.0.1','PORT':'3000','STUDIO_PG_META_URL':'http://127.0.0.1:8080','POSTGRES_HOST':'127.0.0.1','POSTGRES_PORT':'5432','POSTGRES_DB':'postgres','POSTGRES_USER_READ_WRITE':'postgres','PGRST_DB_SCHEMAS':'public,storage,graphql_public','DEFAULT_ORGANIZATION_NAME':'ManuQube','DEFAULT_PROJECT_NAME':'MES '+channel,'SUPABASE_URL':'http://127.0.0.1:8000','SUPABASE_PUBLIC_URL':public,'ENABLED_FEATURES_LOGS_ALL':'false','SNIPPETS_MANAGEMENT_FOLDER':'/tmp/snippets','EDGE_FUNCTIONS_MANAGEMENT_FOLDER':'/tmp/functions'},'512Mi','96Mi',mounts=[mount('studio-tmp','/tmp')]);studioct['env']+=secretrefs({'POSTGRES_PASSWORD':'POSTGRES_PASSWORD','PG_META_CRYPTO_KEY':'PG_META_CRYPTO_KEY','SUPABASE_ANON_KEY':'ANON_KEY','SUPABASE_SERVICE_KEY':'SERVICE_ROLE_KEY','AUTH_JWT_SECRET':'JWT_SECRET'});studioct['securityContext']['readOnlyRootFilesystem']=False
 o.append(obj('ConfigMap','mes-admin-control',ns,data={'until':'0','supervisor.sh':pathlib.Path(__file__).with_name('admin-supervisor.sh').read_text()}))
 for ct,args in [(studioct,['node','/app/apps/studio/server.js']),(meta,['node','/usr/src/app/dist/server/server.js'])]:
  ct['command']=['/bin/sh','/admin-control/supervisor.sh'];ct['args']=args
  ct['volumeMounts'].append(mount('admin-control','/admin-control',ro=True))
  ct['resources']['requests']={'cpu':'5m','memory':'8Mi'}
 gw=container('https','caddy:2-alpine',{},'128Mi','32Mi',mounts=[mount('tls','/certs',ro=True),mount('gateway','/etc/caddy',ro=True),mount('caddy-data','/data'),mount('caddy-config','/config')],ports=[{'name':'https','containerPort':8443}],readinessProbe={'httpGet':{'scheme':'HTTPS','port':8443,'path':'/health'},'periodSeconds':10});gw['command']=['/bin/sh','-c'];gw['args']=['caddy run --config /etc/caddy/Caddyfile & pid=$!; trap "kill $pid; wait $pid" TERM INT; while kill -0 "$pid" 2>/dev/null; do sleep 3600 & wait $!; caddy reload --config /etc/caddy/Caddyfile --force; done; wait "$pid"'];gw['securityContext']['capabilities']['add']=['NET_BIND_SERVICE'];gw['env']+=secretrefs({'ANON_KEY':'ANON_KEY','SERVICE_ROLE_KEY':'SERVICE_ROLE_KEY','STUDIO_HASH':'STUDIO_HASH'})
 backup=container('backup','supabase/postgres:17.6.1.136',{'PGHOST':'127.0.0.1','PGUSER':'supabase_admin','PGDATABASE':'postgres'},'192Mi','32Mi',mounts=[mount('backup','/backups'),mount('storage','/source-storage',ro=True),mount('backup-tmp','/tmp')],command=['/bin/bash','-c'],args=['''set -eu
umask 077
sleep 300
while true; do
 stamp=$(date -u +%Y%m%dT%H%M%SZ)
 if pg_dump --format=custom --file=/backups/database-$stamp.dump.tmp; then mv /backups/database-$stamp.dump.tmp /backups/database-$stamp.dump; fi
 if pg_dumpall --globals-only > /backups/roles-$stamp.sql.tmp; then mv /backups/roles-$stamp.sql.tmp /backups/roles-$stamp.sql; fi
 tar -czf /backups/storage-$stamp.tar.gz.tmp -C /source-storage . && mv /backups/storage-$stamp.tar.gz.tmp /backups/storage-$stamp.tar.gz
 find /backups -type f -mtime +7 -delete
 sleep 86400
done''']);backup['env']+=secretrefs({'PGPASSWORD':'POSTGRES_PASSWORD'})
 volumes=[{'name':name,'persistentVolumeClaim':{'claimName':'mes-supabase-'+name}} for name in ['database','storage','backup']]+[{'name':'tls','secret':{'secretName':'mes-supabase-tls'}},{'name':'init','configMap':{'name':'mes-supabase-init'}},{'name':'gateway','configMap':{'name':'mes-supabase-gateway'}}]+[{'name':n,'emptyDir':{}} for n in ['pg-run','rt-tmp','storage-tmp','studio-tmp','caddy-data','caddy-config','backup-tmp']]
 volumes.append({'name':'admin-control','configMap':{'name':'mes-admin-control'}})
 initct=container('prepare-db','supabase/postgres:17.6.1.136',{},'128Mi','32Mi',mounts=[mount('database','/volume')],command=['/bin/bash','-ec'],args=['mkdir -p /volume/data /volume/config; if [ ! -f /volume/config/.prepared ]; then cp -R /etc/postgresql-custom/. /volume/config/; touch /volume/config/.prepared; fi']);initct['securityContext'].update({'runAsUser':100,'readOnlyRootFilesystem':False})
 spec={'serviceName':'mes-supabase','replicas':1,'selector':{'matchLabels':{'app':'mes-supabase'}},'template':{'metadata':{'labels':{'app':'mes-supabase','cortanex.io/component':'mes-backend'}},'spec':{'automountServiceAccountToken':False,'securityContext':{'runAsNonRoot':True,'runAsUser':10001,'runAsGroup':10001,'fsGroup':10001,'seccompProfile':{'type':'RuntimeDefault'}},'terminationGracePeriodSeconds':60,'affinity':{'nodeAffinity':{'preferredDuringSchedulingIgnoredDuringExecution':[{'weight':100,'preference':{'matchExpressions':[{'key':'kubernetes.io/hostname','operator':'In','values':[{'dev':'cortanex-server2','staging':'cortanex-laptop','production':'cortanex-server3'}[channel]]}]}}]}},'initContainers':[initct],'containers':[db,auth,rest,realtime,storage,meta,studioct,gw,backup],'volumes':volumes}}}
 o.append(obj('StatefulSet','mes-supabase',ns,spec,api='apps/v1'))
 o.append(obj('Service','mes-supabase',ns,{'selector':{'app':'mes-supabase'},'ports':[{'name':'https','port':8443,'targetPort':8443}]}))
 o[-1]['metadata']['annotations']={'traefik.ingress.kubernetes.io/service.serversscheme':'https','traefik.ingress.kubernetes.io/service.serverstransport':ns+'-mes-supabase@kubernetescrd'}
 o.append(obj('ServersTransport','mes-supabase',ns,{'serverName':svc,'rootCAsSecrets':['mes-supabase-tls']},api='traefik.io/v1alpha1'))
 o.append(obj('Ingress','mes-supabase-studio',ns,{'ingressClassName':'traefik','tls':[{'hosts':[studio],'secretName':'mes-supabase-tls' if channel=='production' else 'public-apps-tls'}],'rules':[{'host':studio,'http':{'paths':[{'path':'/','pathType':'Prefix','backend':{'service':{'name':'mes-supabase','port':{'number':8443}}}}]}}]},api='networking.k8s.io/v1',))
 o[-1]['metadata']['annotations']={'traefik.ingress.kubernetes.io/router.entrypoints':'websecure','traefik.ingress.kubernetes.io/service.serversscheme':'https','traefik.ingress.kubernetes.io/service.serverstransport':ns+'-mes-supabase@kubernetescrd'}
 # Secrets are not inserted into ConfigMaps; URL passwords remain within this protected manifest only.
 for c in [auth,rest,storage]:
  for e in c['env']:
   if 'value' in e and creds['POSTGRES_PASSWORD'] in e['value']:
    key=c['name'].upper()+'_'+e['name'];data[key]=e.pop('value');e['valueFrom']={'secretKeyRef':{'name':'mes-supabase','key':key}}
 ALL.extend(o)
 (OUT/(channel+'.json')).write_text(json.dumps({'apiVersion':'v1','kind':'List','items':o},indent=2));(OUT/(channel+'.json')).chmod(0o600)
(OUT/'all.json').write_text(json.dumps({'apiVersion':'v1','kind':'List','items':ALL},indent=2));(OUT/'all.json').chmod(0o600)
print('Generated protected Supabase manifests for three independent environments.')
