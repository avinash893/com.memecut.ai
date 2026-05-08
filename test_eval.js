const script = 'getSequenceInfo()';
const safeScript = `(function(){ try { return ${script}; } catch(e) { return '{"error": "ExtendScript Runtime: ' + e.toString().replace(/"/g, '\\\\"') + '"}'; } })()`;
console.log(safeScript);
