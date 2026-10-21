"""Publish one environment record on a separate branch; never commit into main."""
import base64,json,os,time,urllib.request,urllib.error
repo=os.environ['GITHUB_REPOSITORY'];env=os.environ['TARGET_ENV'];ref=os.environ['GITHUB_REF'];token=os.environ['GITHUB_TOKEN']
if env not in ['dev','staging','production']:raise ValueError('Invalid environment')
if (env=='production' and ref!='refs/heads/main') or (env!='production' and not ref.startswith('refs/tags/'+env+'-')):raise ValueError('Ref does not authorize this environment')
url='https://api.github.com/repos/'+repo+'/contents/releases/'+env+'.json'
body=json.dumps({'image':os.environ['RELEASE_IMAGE'],'commit':os.environ['GITHUB_SHA'],'environment':env,'ref':ref},indent=2)+'\n'
headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'}
for attempt in range(5):
 try:
  with urllib.request.urlopen(urllib.request.Request(url+'?ref=deploy-releases',headers=headers),timeout=20) as r:current=json.load(r)
  payload={'message':'Publish verified '+env+' release','branch':'deploy-releases','sha':current['sha'],'content':base64.b64encode(body.encode()).decode()}
  with urllib.request.urlopen(urllib.request.Request(url,data=json.dumps(payload).encode(),headers=headers,method='PUT'),timeout=20) as r:json.load(r)
  print('Published',env,os.environ['GITHUB_SHA']);break
 except urllib.error.HTTPError as e:
  if e.code not in [409,422] or attempt==4:raise
  time.sleep(attempt+1)
