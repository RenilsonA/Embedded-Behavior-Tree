// Prints the firmware order computed by the Studio for <xml> <mainTree> as JSON.
const fs = require('fs');
const M = require('../frontend/js/model.js');
const [xmlPath, mainTree] = process.argv.slice(2);
const imp = M.importXml(fs.readFileSync(xmlPath, 'utf8'));
imp.mainTreeName = mainTree;
const p = M.projectFromImport(imp, 'x');
const out = M.compiledOrder(p).map(e => {
  const n = p.trees[e.treeId].nodes[e.nodeId];
  return [n.type, n.props.code || n.props.msec || n.props.num || '', e.st, e.ft];
});
console.log(JSON.stringify(out));
