// MemeCut AI - MCP-inspired Premiere Pro helpers
// Adapted from the working AdobePremiereProMCP CEP panel with unique mcpx_* names
// so MemeCut's legacy host functions keep their original return shapes.

function mcpx_ok(data) { return JSON.stringify({ success: true, data: data }); }
function mcpx_err(message) { return JSON.stringify({ success: false, error: String(message) }); }

if (typeof JSON === "undefined") {
    JSON = {
        stringify: function(obj) {
            if (obj === null) return "null";
            if (typeof obj === "undefined") return undefined;
            if (typeof obj === "string") return '"' + obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t") + '"';
            if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
            if (obj instanceof Array) {
                var a = [];
                for (var i = 0; i < obj.length; i++) a.push(JSON.stringify(obj[i]));
                return "[" + a.join(",") + "]";
            }
            if (typeof obj === "object") {
                var p = [];
                for (var k in obj) if (obj.hasOwnProperty(k)) p.push('"' + k + '":' + JSON.stringify(obj[k]));
                return "{" + p.join(",") + "}";
            }
            return '""';
        },
        parse: function(s) { return eval("(" + s + ")"); }
    };
}

function mcpx_parseArgs(argsJson, requiredFields) {
    var args = {};
    if (argsJson !== undefined && argsJson !== null && argsJson !== "") {
        try { args = JSON.parse(argsJson); }
        catch (e) { return { error: "Invalid JSON arguments: " + e.message }; }
    }
    if (requiredFields) {
        for (var i = 0; i < requiredFields.length; i++) {
            if (args[requiredFields[i]] === undefined || args[requiredFields[i]] === null || args[requiredFields[i]] === "") {
                return { error: "Missing required parameter: " + requiredFields[i] };
            }
        }
    }
    return args;
}

function mcpx_activeSequence() {
    if (!app.project) return null;
    return app.project.activeSequence || null;
}

function mcpx_ping() {
    try {
        var ver = "unknown";
        try { ver = app.version; } catch (e1) {}
        var projectOpen = false;
        var projectName = "";
        try {
            projectOpen = !!(app.project && app.project.name);
            if (projectOpen) projectName = app.project.name;
        } catch (e2) {}
        var seq = mcpx_activeSequence();
        return mcpx_ok({
            premiere_running: true,
            premiere_version: ver,
            project_open: projectOpen,
            project_name: projectName,
            active_sequence: seq ? seq.name : ""
        });
    } catch (e) { return mcpx_err("Ping failed: " + e.message); }
}

function mcpx_projectInfo() {
    try {
        if (!app.project) return mcpx_err("No project is open. Open or create a project first.");
        var seqs = [];
        var numSeqs = 0;
        try { numSeqs = app.project.sequences.numItems || app.project.sequences.numSequences || 0; } catch (e1) {}
        for (var i = 0; i < numSeqs; i++) {
            var s = app.project.sequences[i];
            if (s) seqs.push({ index: i, name: s.name, id: String(s.sequenceID || i) });
        }
        return mcpx_ok({
            name: app.project.name,
            path: app.project.path,
            sequences: seqs,
            sequence_count: seqs.length,
            is_modified: !!app.project.isDocumentModified
        });
    } catch (e) { return mcpx_err("Failed to get project info: " + e.message); }
}

function mcpx_sequenceList() {
    try {
        if (!app.project) return mcpx_err("No project is open.");
        var seqs = [];
        var numSeqs = 0;
        try { numSeqs = app.project.sequences.numItems || app.project.sequences.numSequences || 0; } catch (e1) {}
        for (var i = 0; i < numSeqs; i++) {
            var s = app.project.sequences[i];
            if (s) seqs.push({ index: i, name: s.name, id: String(s.sequenceID || i) });
        }
        return mcpx_ok({ sequences: seqs, count: seqs.length });
    } catch (e) { return mcpx_err("Failed to list sequences: " + e.message); }
}

function mcpx_timelineState() {
    try {
        if (!app.project) return mcpx_err("No project is open.");
        var seq = mcpx_activeSequence();
        if (!seq) return mcpx_err("No active sequence. Create or open a sequence first.");
        var tracks = [];
        var videoCount = 0;
        var audioCount = 0;
        try { videoCount = seq.videoTracks.numTracks; } catch (e1) {}
        try { audioCount = seq.audioTracks.numTracks; } catch (e2) {}

        for (var v = 0; v < videoCount; v++) {
            var vt = seq.videoTracks[v];
            if (!vt) continue;
            var vclips = [];
            var vcCount = 0;
            try { vcCount = vt.clips.numItems; } catch (e3) {}
            for (var c = 0; c < vcCount; c++) {
                var clip = vt.clips[c];
                if (!clip) continue;
                var mediaPath = "";
                try { mediaPath = clip.projectItem ? clip.projectItem.getMediaPath() : ""; } catch (e4) {}
                vclips.push({ index: c, name: clip.name, mediaPath: mediaPath, start: clip.start.seconds, end: clip.end.seconds, duration: clip.duration.seconds });
            }
            tracks.push({ index: v, name: vt.name || ("Video " + (v + 1)), type: "video", clipCount: vcCount, clips: vclips });
        }

        for (var a = 0; a < audioCount; a++) {
            var at = seq.audioTracks[a];
            if (!at) continue;
            var aclips = [];
            var acCount = 0;
            try { acCount = at.clips.numItems; } catch (e5) {}
            for (var ac = 0; ac < acCount; ac++) {
                var aclip = at.clips[ac];
                if (!aclip) continue;
                aclips.push({ index: ac, name: aclip.name, start: aclip.start.seconds, end: aclip.end.seconds, duration: aclip.duration.seconds });
            }
            tracks.push({ index: a, name: at.name || ("Audio " + (a + 1)), type: "audio", clipCount: acCount, clips: aclips });
        }

        return mcpx_ok({
            sequence: { name: seq.name, id: String(seq.sequenceID || ""), duration: seq.end ? seq.end.seconds : 0 },
            videoTrackCount: videoCount,
            audioTrackCount: audioCount,
            tracks: tracks
        });
    } catch (e) { return mcpx_err("Failed to get timeline state: " + e.message); }
}

function mcpx_addMarker(argsJson) {
    try {
        var args = mcpx_parseArgs(argsJson);
        if (args.error) return mcpx_err(args.error);
        var seq = mcpx_activeSequence();
        if (!seq) return mcpx_err("No active sequence.");
        var seconds = args.seconds;
        if (seconds === undefined || seconds === null) {
            try { seconds = seq.getPlayerPosition().seconds; } catch (e1) { seconds = 0; }
        }
        var marker = seq.markers.createMarker(seconds);
        marker.name = args.name || "MemeCut MCP Marker";
        marker.comments = args.comment || "Created from MemeCut MCP tab";
        if (args.duration !== undefined) marker.end = seconds + Number(args.duration);
        return mcpx_ok({ message: "Marker added", seconds: seconds, name: marker.name });
    } catch (e) { return mcpx_err("Failed to add marker: " + e.message); }
}

function mcpx_setPlayhead(argsJson) {
    try {
        var args = mcpx_parseArgs(argsJson, ["seconds"]);
        if (args.error) return mcpx_err(args.error);
        var seq = mcpx_activeSequence();
        if (!seq) return mcpx_err("No active sequence.");
        seq.setPlayerPosition(String(Math.round(Number(args.seconds) * 254016000000)));
        return mcpx_ok({ message: "Playhead moved", seconds: Number(args.seconds) });
    } catch (e) { return mcpx_err("Failed to set playhead: " + e.message); }
}

function mcpx_browseMediaFiles(argsJson) {
    try {
        var args = mcpx_parseArgs(argsJson, ["path"]);
        if (args.error) return mcpx_err(args.error);
        var folder = new Folder(args.path);
        if (!folder.exists) return mcpx_err("Path not found: " + args.path);
        var mediaExts = ["mp4","mov","avi","mkv","mxf","m4v","wmv","mpg","mpeg","m2t","mts","wav","mp3","aac","aif","aiff","flac","ogg","png","jpg","jpeg","tif","tiff","psd","ai","bmp","gif","webp","prproj","mogrt"];
        var items = [];
        var allFiles = folder.getFiles();
        for (var i = 0; i < allFiles.length; i++) {
            var f = allFiles[i];
            if (!f) continue;
            if (f instanceof Folder) {
                items.push({ name: f.name, path: f.fsName, isFolder: true, type: "folder" });
            } else {
                var parts = f.name.split(".");
                var ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
                var isMedia = false;
                for (var j = 0; j < mediaExts.length; j++) if (ext === mediaExts[j]) { isMedia = true; break; }
                if (isMedia) items.push({ name: f.name, path: f.fsName, isFolder: false, type: ext, size: f.length });
            }
        }
        return mcpx_ok({ path: args.path, items: items, count: items.length });
    } catch (e) { return mcpx_err("Failed to browse media files: " + e.message); }
}

function mcpx_favoriteLocations() {
    try {
        var locations = [];
        try { locations.push({ name: "Home", path: Folder.myDocuments.parent.fsName }); } catch (e1) {}
        try { locations.push({ name: "Documents", path: Folder.myDocuments.fsName }); } catch (e2) {}
        try { locations.push({ name: "Desktop", path: Folder.desktop.fsName }); } catch (e3) {}
        try { locations.push({ name: "Movies", path: Folder.myDocuments.parent.fsName + "/Movies" }); } catch (e4) {}
        try { locations.push({ name: "Downloads", path: Folder.myDocuments.parent.fsName + "/Downloads" }); } catch (e5) {}
        try { locations.push({ name: "Premiere Projects", path: Folder.myDocuments.fsName + "/Adobe/Premiere Pro" }); } catch (e6) {}
        return mcpx_ok({ locations: locations });
    } catch (e) { return mcpx_err("Failed to get favorite locations: " + e.message); }
}

function mcpx_importFiles(argsJson) {
    try {
        var args = mcpx_parseArgs(argsJson);
        if (args.error) return mcpx_err(args.error);
        if (!app.project) return mcpx_err("No project is open. Open or create a project first.");
        var paths = args.paths || (args.path ? [args.path] : null);
        if (!paths || paths.length === 0) return mcpx_err("Missing required parameter: paths");
        var missing = [];
        for (var i = 0; i < paths.length; i++) {
            var f = new File(paths[i]);
            if (!f.exists) missing.push(paths[i]);
        }
        if (missing.length > 0) return mcpx_err("Files not found: " + missing.join(", "));
        app.project.importFiles(paths, true, app.project.getInsertionBin(), false);
        return mcpx_ok({ message: "Imported " + paths.length + " file(s)", count: paths.length });
    } catch (e) { return mcpx_err("Failed to import files: " + e.message); }
}

function mcpx_execute(command, argsJson) {
    if (command === "ping") return mcpx_ping();
    if (command === "projectInfo") return mcpx_projectInfo();
    if (command === "sequenceList") return mcpx_sequenceList();
    if (command === "timelineState") return mcpx_timelineState();
    if (command === "addMarker") return mcpx_addMarker(argsJson);
    if (command === "setPlayhead") return mcpx_setPlayhead(argsJson);
    if (command === "browseMediaFiles") return mcpx_browseMediaFiles(argsJson);
    if (command === "favoriteLocations") return mcpx_favoriteLocations();
    if (command === "importFiles") return mcpx_importFiles(argsJson);
    return mcpx_err("Unknown MCP command: " + command);
}
