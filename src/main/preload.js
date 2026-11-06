const { contextBridge, ipcRenderer, webUtils } = require('electron');
const path = require('path');
const os = require('os');

const inv = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  home: os.homedir(),
  path: {
    sep: path.sep,
    join: (...a) => path.join(...a),
    resolve: (...a) => path.resolve(...a),
    dirname: (p) => path.dirname(p),
    basename: (p) => path.basename(p),
  },
  list: inv('fs:list'),
  space: inv('fs:space'),
  stat: inv('fs:stat'),
  drives: inv('drives:list'),
  places: inv('places:list'),
  icon: inv('icon:get'),
  conflicts: inv('op:conflicts'),
  runOp: inv('op:run'),
  cancelOp: inv('op:cancel'),
  zipPack: inv('zip:pack'),
  zipInspect: inv('zip:inspect'),
  zipUnpack: inv('zip:unpack'),
  zipList: inv('zip:list'),
  zipModify: inv('zip:modify'),
  zipExtract: inv('zip:extract'),
  zipOpen: inv('zip:open'),
  zipTemp: inv('zip:temp'),
  viewRead: inv('view:read'),
  docRender: inv('doc:render'),
  thumb: inv('thumb:get'),
  ftAttrsGet: inv('ft:attrsGet'),
  ftAttrsSet: inv('ft:attrsSet'),
  ftProps: inv('ft:props'),
  ftSpace: inv('ft:space'),
  ftChecksumCreate: inv('ft:checksumCreate'),
  ftChecksumVerify: inv('ft:checksumVerify'),
  ftSplit: inv('ft:split'),
  ftCombine: inv('ft:combine'),
  ftCompare: inv('ft:compare'),
  ftTestArchive: inv('ft:testArchive'),
  ftEncode: inv('ft:encode'),
  ftDecode: inv('ft:decode'),
  ftCommentGet: inv('ft:commentGet'),
  ftCommentSet: inv('ft:commentSet'),
  clipRead: inv('clip:read'),
  clipWrite: inv('clip:write'),
  hotlistImportTC: inv('hotlist:importTC'),
  writeFile: inv('file:write'),
  mkTemp: inv('fs:mktemp'),
  del: inv('op:delete'),
  mkdir: inv('op:mkdir'),
  open: inv('shell:open'),
  run: inv('shell:run'),
  reveal: inv('shell:reveal'),
  quit: inv('app:quit'),
  nasConnect: inv('nas:connect'),
  nasDisconnect: inv('nas:disconnect'),
  nasList: inv('nas:list'),
  nasMkdir: inv('nas:mkdir'),
  nasRename: inv('nas:rename'),
  nasDelete: inv('nas:delete'),
  nasTemp: inv('nas:temp'),
  nasStreamUrl: inv('nas:streamUrl'),
  mediaPrepare: inv('media:prepare'),
  mediaFfmpeg: inv('media:ffmpeg'),
  nasPut: inv('nas:put'),
  nasDownload: inv('nas:download'),
  nasUpload: inv('nas:upload'),
  nasCrypt: inv('nas:crypt'),
  openUrl: inv('shell:openUrl'),
  cloudDropboxSignIn: inv('cloud:dropboxSignIn'),
  cloudGoogleSignIn: inv('cloud:googleSignIn'),
  cloudCancelSignIn: inv('cloud:cancelSignIn'),
  cloudDefaults: inv('cloud:defaults'),
  cloudConnect: inv('cloud:connect'),
  sshConnect: inv('ssh:connect'),
  sshShell: inv('ssh:shell'),
  sshWrite: inv('ssh:write'),
  sshResize: inv('ssh:resize'),
  openFileDialog: inv('dialog:openFile'),
  pathForFile: (f) => webUtils.getPathForFile(f),
  onSshData: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('ssh:data', h);
    return () => ipcRenderer.removeListener('ssh:data', h);
  },
  onSshClosed: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('ssh:closed', h);
    return () => ipcRenderer.removeListener('ssh:closed', h);
  },
  renameBatch: inv('fs:renameBatch'),
  syncCompare: inv('sync:compare'),
  syncRun: inv('sync:run'),
  search: inv('search:run'),
  onSearch: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('search:batch', h);
    return () => ipcRenderer.removeListener('search:batch', h);
  },
  onProgress: (cb) => {
    const h = (_e, p) => cb(p);
    ipcRenderer.on('op:progress', h);
    return () => ipcRenderer.removeListener('op:progress', h);
  },
});
