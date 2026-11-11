"""Freeze actual development JS/maps so an active preview cannot invalidate evidence."""
import datetime,hashlib,json,zipfile
from pathlib import Path
root=Path(__file__).resolve().parent.parent
source=root/'.next/hsk3-check/dev/static'
base=root/'.local-postgres/hsk24'
archive=base/'hsk4-continuous-dev-client-artifacts.zip'
manifest_path=base/'hsk4-continuous-dev-client-artifacts.json'
report_path=base/'hsk4-continuous-dev-client-isolation.json'
if archive.exists() or manifest_path.exists():raise RuntimeError('IMMUTABLE_SNAPSHOT_ALREADY_EXISTS')
sha=lambda b:hashlib.sha256(b).hexdigest()
files=sorted(p for p in source.rglob('*') if p.is_file() and p.suffix in ['.js','.map'])
assert files
captured=[]
for p in files:
 assert p.resolve().is_relative_to(root)
 before=p.stat();data=p.read_bytes();after=p.stat()
 assert (before.st_mtime_ns,before.st_size)==(after.st_mtime_ns,after.st_size),'ASSET_CHANGED_DURING_SNAPSHOT'
 captured.append((p,data))
assert files==sorted(p for p in source.rglob('*') if p.is_file() and p.suffix in ['.js','.map']),'ASSET_SET_CHANGED'
registry=json.loads((root/'content/hsk24/manifest.json').read_text('utf8'))
markers=set()
for row in registry['packages']:
 assert Path(row['file']).name==row['file']
 p=json.loads((root/'content/hsk24'/row['file']).read_text('utf8'))
 markers.update(k['id'] for k in p['privateKeys'])
assert all(not any(m.encode() in data for m in markers) for _,data in captured),'PRIVATE_KEY_MARKER_FOUND'
rows=[]
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED) as z:
 for p,data in captured:
  name=p.relative_to(source).as_posix();z.writestr(name,data)
  rows.append({'source':p.relative_to(root).as_posix(),'archiveMember':name,'sha256':sha(data),'bytes':len(data)})
manifest={'capturedAtUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceRoot':source.relative_to(root).as_posix(),'scope':'Immutable actualWebpackdevelopment JS/maps after seven read-only HTML routes; active preview may generate later assets outside this snapshot.','files':rows}
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
report={'passed':True,'scope':manifest['scope'],'files':len(rows),'bytes':sum(r['bytes'] for r in rows),'privateKeyIdsChecked':len(markers),'markerHits':0,'artifactDigest':sha('\n'.join(sorted(r['source']+':'+r['sha256'] for r in rows)).encode()),'archive':archive.relative_to(root).as_posix(),'archiveSha256':sha(archive.read_bytes()),'manifest':manifest_path.relative_to(root).as_posix(),'manifestSha256':sha(manifest_path.read_bytes()),'limits':'Bounded private-key-ID scan plus separate public projection tests; not a formal leak proof or claim about future livepreview assets.'}
report_path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:report[k] for k in ['files','bytes','privateKeyIdsChecked','markerHits','artifactDigest','archiveSha256']}))
