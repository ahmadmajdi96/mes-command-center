#!/usr/bin/env python3
"""Lease Studio + metadata tools without restarting the database."""
import argparse,datetime,json,os,shlex,subprocess,time
p=argparse.ArgumentParser();p.add_argument('namespace',choices=['development','staging','manuqube']);g=p.add_mutually_exclusive_group();g.add_argument('--minutes',type=int);g.add_argument('--off',action='store_true');a=p.parse_args()
k=shlex.split(os.environ.get('KUBECTL','kubectl'))+['-n',a.namespace]
if a.minutes is not None or a.off:
 if a.minutes is not None and not 1<=a.minutes<=240:p.error('Choose 1–240 minutes')
 until=0 if a.off else int(time.time())+a.minutes*60
 subprocess.run(k+['patch','configmap','mes-admin-control','--type=merge','-p',json.dumps({'data':{'until':str(until)}})],check=True)
 subprocess.run(k+['annotate','pod','mes-supabase-0','cortanex.io/admin-control-refresh='+str(time.time_ns()),'--overwrite'],check=True)
else:
 d=json.loads(subprocess.check_output(k+['get','configmap','mes-admin-control','-o','json']));until=int(d['data']['until'])
print('Administration paused; data services stay active.' if until<=time.time() else 'Administration enabled until '+datetime.datetime.fromtimestamp(until,datetime.timezone.utc).isoformat())
print('Control changes can take up to two minutes to appear. No database restart is required.')
