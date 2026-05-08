// MemeCut AI - ExtendScript Host Bridge v1.1
// Runs inside Premiere Pro's ExtendScript engine
// KEY CHANGE: All media-path functions now read DIRECTLY from the active timeline.
// Users never need to pick files manually — the extension auto-detects the active clip.

if (typeof JSON !== "object") { JSON = {}; }
(function () {
    "use strict";
    var rx_escapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    function f(n) { return n < 10 ? "0" + n : n; }
    function quote(string) {
        rx_escapable.lastIndex = 0;
        return rx_escapable.test(string) ? "\"" + string.replace(rx_escapable, function (a) {
            var c = meta[a];
            return typeof c === "string" ? c : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
        }) + "\"" : "\"" + string + "\"";
    }
    var meta = { "\b": "\\b", "\t": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r", "\"": "\\\"", "\\": "\\\\" };
    if (typeof JSON.stringify !== "function") {
        JSON.stringify = function (value, replacer, space) {
            var i; var gap = ""; var indent = "";
            function str(key, holder) {
                var i, k, v, length, mind = gap, partial, value = holder[key];
                if (value && typeof value === "object" && typeof value.toJSON === "function") { value = value.toJSON(key); }
                switch (typeof value) {
                    case "string": return quote(value);
                    case "number": return isFinite(value) ? String(value) : "null";
                    case "boolean":
                    case "null": return String(value);
                    case "object":
                        if (!value) return "null";
                        gap += indent; partial = [];
                        if (Object.prototype.toString.apply(value) === "[object Array]") {
                            length = value.length;
                            for (i = 0; i < length; i += 1) { partial[i] = str(i, value) || "null"; }
                            v = partial.length === 0 ? "[]" : "[" + partial.join(",") + "]";
                            gap = mind; return v;
                        }
                        for (k in value) {
                            if (Object.prototype.hasOwnProperty.call(value, k)) {
                                v = str(k, value);
                                if (v) partial.push(quote(k) + ":" + v);
                            }
                        }
                        v = partial.length === 0 ? "{}" : "{" + partial.join(",") + "}";
                        gap = mind; return v;
                }
            }
            return str("", { "": value });
        };
    }
}());

// ─── SEQUENCE INFO ───────────────────────────────────────────────────────────

function getSequenceInfo() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });
        return JSON.stringify({
            name: seq.name,
            duration: seq.end.seconds,
            frameRate: parseFloat(seq.timebase),
            width: seq.frameSizeHorizontal,
            height: seq.frameSizeVertical,
            sequenceID: seq.sequenceID,
            videoTracksCount: seq.videoTracks.numTracks,
            audioTracksCount: seq.audioTracks.numTracks
        });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

function getCurrentTime() {
    try {
        return app.project.activeSequence.getPlayerPosition().seconds.toString();
    } catch (e) { return "0"; }
}

function setPlayerPosition(seconds) {
    try {
        var ticks = Math.round(parseFloat(seconds) * 254016000000);
        app.project.activeSequence.setPlayerPosition(ticks.toString());
        return "ok";
    } catch (e) { return "error:" + e.toString(); }
}

function playSequence()  { try { app.project.activeSequence.player.play(1.0); return "ok"; } catch(e){ return "error:"+e; } }
function pauseSequence() { try { app.project.activeSequence.player.stop(); return "ok"; } catch(e){ return "error:"+e; } }
function isPlaying()     { try { return app.project.activeSequence.player.isPlaying ? "true" : "false"; } catch(e){ return "false"; } }

// ─── TIMELINE-AWARE MEDIA DETECTION (NEW) ────────────────────────────────────

/**
 * getActiveClipInfo()
 * Returns info about the clip currently under the playhead on V1.
 * This is the PRIMARY way MemeCut detects which video to work with.
 * No file picker needed — it reads straight from the timeline.
 */
function getActiveClipInfo() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });

        var currentTicks = seq.getPlayerPosition().ticks;
        var currentSec   = seq.getPlayerPosition().seconds;

        // Search all video tracks (top-down priority so topmost clip wins)
        for (var v = seq.videoTracks.numTracks - 1; v >= 0; v--) {
            var track = seq.videoTracks[v];
            for (var i = 0; i < track.clips.numItems; i++) {
                var c = track.clips[i];
                if (c.start.seconds <= currentSec && c.end.seconds > currentSec) {
                    var mediaPath = "";
                    try { mediaPath = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
                    if (mediaPath) {
                        return JSON.stringify({
                            found: true,
                            trackIndex: v,
                            clipIndex: i,
                            name: c.name,
                            mediaPath: mediaPath,
                            start: c.start.seconds,
                            end: c.end.seconds,
                            duration: c.duration.seconds,
                            inPoint: c.inPoint.seconds,
                            outPoint: c.outPoint.seconds
                        });
                    }
                }
            }
        }
        return JSON.stringify({ found: false, error: "No clip with valid media found at playhead position" });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * getSelectedClipInfo()
 * Returns info about the currently selected clip(s) in the timeline.
 * Used as a secondary detection method if playhead has no clip.
 */
function getSelectedClipInfo() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });

        var results = [];
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var track = seq.videoTracks[v];
            for (var i = 0; i < track.clips.numItems; i++) {
                var c = track.clips[i];
                if (c.isSelected()) {
                    var mediaPath = "";
                    try { mediaPath = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
                    results.push({
                        trackIndex: v,
                        clipIndex: i,
                        name: c.name,
                        mediaPath: mediaPath,
                        start: c.start.seconds,
                        end: c.end.seconds,
                        duration: c.duration.seconds
                    });
                }
            }
        }
        return JSON.stringify(results);
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * getFirstVideoClipPath()
 * Fallback: returns the media path of the very first clip on V1.
 * Used when playhead is at zero and nothing is selected.
 */
function getFirstVideoClipPath() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });
        var track = seq.videoTracks[0];
        if (!track || track.clips.numItems === 0) return JSON.stringify({ error: "No clips on V1" });
        var c = track.clips[0];
        var mediaPath = "";
        try { mediaPath = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
        return JSON.stringify({
            found: true,
            trackIndex: 0,
            clipIndex: 0,
            name: c.name,
            mediaPath: mediaPath,
            start: c.start.seconds,
            end: c.end.seconds,
            duration: c.duration.seconds
        });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * getFirstClipAnyTrack()
 * Method 4: Finds the chronologically first clip on any video track.
 */
function getFirstClipAnyTrack() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });
        var earliest = null;
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var track = seq.videoTracks[v];
            for (var i = 0; i < track.clips.numItems; i++) {
                var c = track.clips[i];
                var mediaPath = "";
                try { mediaPath = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
                if (mediaPath && (!earliest || c.start.seconds < earliest.start)) {
                    earliest = {
                        found: true, trackIndex: v, clipIndex: i, name: c.name, mediaPath: mediaPath,
                        start: c.start.seconds, end: c.end.seconds, duration: c.duration.seconds
                    };
                }
            }
        }
        return JSON.stringify(earliest || { found: false, error: "No clips found" });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * getLargestClipOnTimeline()
 * Method 5: Finds the clip with the longest duration on the timeline.
 */
function getLargestClipOnTimeline() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });
        var largest = null;
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var track = seq.videoTracks[v];
            for (var i = 0; i < track.clips.numItems; i++) {
                var c = track.clips[i];
                var mediaPath = "";
                try { mediaPath = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
                if (mediaPath && (!largest || c.duration.seconds > largest.duration)) {
                    largest = {
                        found: true, trackIndex: v, clipIndex: i, name: c.name, mediaPath: mediaPath,
                        start: c.start.seconds, end: c.end.seconds, duration: c.duration.seconds
                    };
                }
            }
        }
        return JSON.stringify(largest || { found: false, error: "No clips found" });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * getClipClosestToPlayhead()
 * Method 6: Finds the clip whose start time is closest to the playhead, regardless of track.
 */
function getClipClosestToPlayhead() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });
        var currentSec = seq.getPlayerPosition().seconds;
        var closest = null;
        var minDiff = Infinity;
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var track = seq.videoTracks[v];
            for (var i = 0; i < track.clips.numItems; i++) {
                var c = track.clips[i];
                var mediaPath = "";
                try { mediaPath = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
                if (mediaPath) {
                    var diff = Math.abs(c.start.seconds - currentSec);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closest = {
                            found: true, trackIndex: v, clipIndex: i, name: c.name, mediaPath: mediaPath,
                            start: c.start.seconds, end: c.end.seconds, duration: c.duration.seconds
                        };
                    }
                }
            }
        }
        return JSON.stringify(closest || { found: false, error: "No clips found" });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * getProjectBinVideo()
 * Method 7: Searches the project bin recursively for the first video file (ignores timeline entirely).
 */
function getProjectBinVideo() {
    try {
        function searchBin(bin) {
            for (var i = 0; i < bin.children.numItems; i++) {
                var item = bin.children[i];
                if (item.type === ProjectItemType.CLIP || item.type === ProjectItemType.FILE) {
                    var mp = "";
                    try { mp = item.getMediaPath(); } catch(e) {}
                    if (mp && /\.(mp4|mov|avi|mkv)$/i.test(mp)) {
                        return { found: true, name: item.name, mediaPath: mp, start: 0, end: 0, duration: 0 };
                    }
                } else if (item.type === ProjectItemType.BIN) {
                    var found = searchBin(item);
                    if (found) return found;
                }
            }
            return null;
        }
        var result = searchBin(app.project.rootItem);
        return JSON.stringify(result || { found: false, error: "No video files in project bin" });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * getAnyVideoFromProject()
 * Method 8: A loose search of all project items.
 */
function getAnyVideoFromProject() {
    try {
        function searchBin(bin) {
            for (var i = 0; i < bin.children.numItems; i++) {
                var item = bin.children[i];
                var mp = "";
                try { mp = item.getMediaPath(); } catch(e) {}
                if (mp && /\.(mp4|mov|avi)$/i.test(mp)) {
                     return { found: true, name: item.name, mediaPath: mp, start: 0, end: 0, duration: 0 };
                }
                if (item.type === ProjectItemType.BIN) {
                    var res = searchBin(item);
                    if (res) return res;
                }
            }
            return null;
        }
        var result = searchBin(app.project.rootItem);
        return JSON.stringify(result || { found: false, error: "No video found in project" });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * getAllTimelineMediaPaths()
 * Returns all unique media file paths across all video tracks.
 * Used when the AI needs to analyze the whole sequence.
 */
function getAllTimelineMediaPaths() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });

        var paths = [];
        var seen  = {};
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var track = seq.videoTracks[v];
            for (var i = 0; i < track.clips.numItems; i++) {
                var c = track.clips[i];
                var mediaPath = "";
                try { mediaPath = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
                if (mediaPath && !seen[mediaPath]) {
                    seen[mediaPath] = true;
                    paths.push({
                        trackIndex: v,
                        clipIndex: i,
                        name: c.name,
                        mediaPath: mediaPath,
                        start: c.start.seconds,
                        end: c.end.seconds,
                        duration: c.duration.seconds
                    });
                }
            }
        }
        return JSON.stringify(paths);
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * getPrimaryAudioPath()
 * Returns the media path of the first audio clip on A1.
 * For silence detection / transcription: audio is always on A1 for main interview clips.
 */
function getPrimaryAudioPath() {
    try {
        var seq = app.project.activeSequence;
        if (!seq) return JSON.stringify({ error: "No active sequence" });

        var currentSec = seq.getPlayerPosition().seconds;
        
        // First try: audio clip linked to current playhead clip
        for (var a = 0; a < seq.audioTracks.numTracks; a++) {
            var atrack = seq.audioTracks[a];
            for (var i = 0; i < atrack.clips.numItems; i++) {
                var c = atrack.clips[i];
                if (c.start.seconds <= currentSec && c.end.seconds > currentSec) {
                    var mp = "";
                    try { mp = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
                    if (mp) return JSON.stringify({ found: true, mediaPath: mp, start: c.start.seconds, end: c.end.seconds, duration: c.duration.seconds, trackIndex: a, clipIndex: i });
                }
            }
        }

        // Fallback: first valid clip on any audio track
        for (var a = 0; a < seq.audioTracks.numTracks; a++) {
            var atrack = seq.audioTracks[a];
            for (var i = 0; i < atrack.clips.numItems; i++) {
                var ac = atrack.clips[i];
                var mp2 = "";
                try { mp2 = ac.projectItem ? ac.projectItem.getMediaPath() : ""; } catch(e2) {}
                if (mp2) return JSON.stringify({ found: true, mediaPath: mp2, start: ac.start.seconds, end: ac.end.seconds, duration: ac.duration.seconds, trackIndex: a, clipIndex: i });
            }
        }

        return JSON.stringify({ found: false, error: "No audio clips with valid media paths found" });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
}

// ─── CLIP OPERATIONS ─────────────────────────────────────────────────────────

function getAllClipsOnTrack(trackIndex) {
    try {
        var seq = app.project.activeSequence;
        var track = seq.videoTracks[parseInt(trackIndex)];
        var clips = [];
        for (var i = 0; i < track.clips.numItems; i++) {
            var c = track.clips[i];
            var mp = "";
            try { mp = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
            clips.push({
                index: i,
                name: c.name,
                start: c.start.seconds,
                end: c.end.seconds,
                duration: c.duration.seconds,
                mediaPath: mp
            });
        }
        return JSON.stringify(clips);
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

function getAudioClipsInfo() {
    try {
        var seq = app.project.activeSequence;
        var result = [];
        for (var t = 0; t < seq.audioTracks.numTracks; t++) {
            var track = seq.audioTracks[t];
            for (var i = 0; i < track.clips.numItems; i++) {
                var c = track.clips[i];
                var mp = "";
                try { mp = c.projectItem ? c.projectItem.getMediaPath() : ""; } catch(e2) {}
                result.push({ track: t, index: i, name: c.name, start: c.start.seconds, end: c.end.seconds, mediaPath: mp });
            }
        }
        return JSON.stringify(result);
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ─── IMPORT & INSERT MEDIA ───────────────────────────────────────────────────

function importAndInsertMedia(filePath, insertAtSeconds, durationSeconds, videoTrackIndex, audioTrackIndex) {
    try {
        var seq = app.project.activeSequence;
        filePath = filePath.replace(/\\\\/g, "\\");

        app.project.importFiles([filePath], true, app.project.rootItem, false);
        var item = findProjectItemByPath(filePath);
        if (!item) return JSON.stringify({ error: "Import failed: " + filePath });

        var vTrack = parseInt(videoTrackIndex) || 1;
        var insertTicks = Math.round(parseFloat(insertAtSeconds) * 254016000000);
        var durTicks    = Math.round(parseFloat(durationSeconds)  * 254016000000);

        while (seq.videoTracks.numTracks <= vTrack) seq.videoTracks.addTrack();
        var track = seq.videoTracks[vTrack];
        track.insertClip(item, insertTicks);

        for (var i = 0; i < track.clips.numItems; i++) {
            var c = track.clips[i];
            if (Math.abs(c.start.seconds - parseFloat(insertAtSeconds)) < 0.2) {
                c.end.ticks = (insertTicks + durTicks).toString();
                break;
            }
        }
        return JSON.stringify({ success: true });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

function findProjectItemByPath(path) {
    function searchBin(bin) {
        for (var i = 0; i < bin.children.numItems; i++) {
            var item = bin.children[i];
            try {
                var mp = item.getMediaPath();
                if (mp && (mp === path || mp.replace(/\\/g,"/") === path.replace(/\\/g,"/"))) return item;
            } catch(e) {}
            if (item.type === ProjectItemType.BIN) {
                var found = searchBin(item);
                if (found) return found;
            }
        }
        return null;
    }
    return searchBin(app.project.rootItem);
}

// ─── CUT / RIPPLE DELETE ─────────────────────────────────────────────────────

function cutClipAtTime(seconds, trackIndex) {
    try {
        var seq = app.project.activeSequence;
        var ticks = Math.round(parseFloat(seconds) * 254016000000);
        var track = seq.videoTracks[parseInt(trackIndex) || 0];
        for (var i = 0; i < track.clips.numItems; i++) {
            var c = track.clips[i];
            if (c.start.seconds <= parseFloat(seconds) && c.end.seconds >= parseFloat(seconds)) {
                c.razor(ticks.toString());
                return JSON.stringify({ success: true, clipIndex: i });
            }
        }
        return JSON.stringify({ error: "No clip at that time" });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

function rippleDeleteRange(startSeconds, endSeconds, trackIndex) {
    try {
        var seq   = app.project.activeSequence;
        var start = parseFloat(startSeconds);
        var end   = parseFloat(endSeconds);
        var ti    = parseInt(trackIndex) || 0;

        // Cut at both endpoints first, then delete clips within range
        var startTicks = Math.round(start * 254016000000);
        var endTicks   = Math.round(end   * 254016000000);

        // Razor all video tracks at start and end
        for (var v = 0; v < seq.videoTracks.numTracks; v++) {
            var vtrack = seq.videoTracks[v];
            for (var ci = 0; ci < vtrack.clips.numItems; ci++) {
                var vc = vtrack.clips[ci];
                if (vc.start.seconds < start && vc.end.seconds > start) vc.razor(startTicks.toString());
                if (vc.start.seconds < end   && vc.end.seconds > end)   vc.razor(endTicks.toString());
            }
        }
        // Also razor audio tracks
        for (var a = 0; a < seq.audioTracks.numTracks; a++) {
            var atrack = seq.audioTracks[a];
            for (var ai = 0; ai < atrack.clips.numItems; ai++) {
                var ac = atrack.clips[ai];
                if (ac.start.seconds < start && ac.end.seconds > start) ac.razor(startTicks.toString());
                if (ac.start.seconds < end   && ac.end.seconds > end)   ac.razor(endTicks.toString());
            }
        }

        // Now delete clips entirely within the range (ripple = true)
        for (var v2 = 0; v2 < seq.videoTracks.numTracks; v2++) {
            var vt2 = seq.videoTracks[v2];
            for (var ci2 = vt2.clips.numItems - 1; ci2 >= 0; ci2--) {
                var vc2 = vt2.clips[ci2];
                if (vc2.start.seconds >= start - 0.01 && vc2.end.seconds <= end + 0.01) {
                    vc2.remove(false, true); // ripple=true shifts everything left
                }
            }
        }
        // Delete matching audio segments
        for (var a2 = 0; a2 < seq.audioTracks.numTracks; a2++) {
            var at2 = seq.audioTracks[a2];
            for (var ai2 = at2.clips.numItems - 1; ai2 >= 0; ai2--) {
                var ac2 = at2.clips[ai2];
                if (ac2.start.seconds >= start - 0.01 && ac2.end.seconds <= end + 0.01) {
                    ac2.remove(false, true);
                }
            }
        }

        return JSON.stringify({ success: true });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ─── FREEZE FRAME ────────────────────────────────────────────────────────────

function createFreezeFrameAtTime(seconds, durationSeconds) {
    try {
        var seq  = app.project.activeSequence;
        var sec  = parseFloat(seconds);
        var dur  = parseFloat(durationSeconds) || 2;

        // Export current frame as PNG to temp
        var tempPath = Folder.temp.fsName + "/memecut_freeze_" + Math.round(sec*100) + ".png";
        seq.exportFramePNG(Math.round(sec * 254016000000).toString(), tempPath);

        app.project.importFiles([tempPath], true, app.project.rootItem, false);
        var item = findProjectItemByPath(tempPath);
        if (!item) return JSON.stringify({ error: "Freeze export failed" });

        var track = seq.videoTracks[0];
        var insertTicks = Math.round(sec * 254016000000);
        var durTicks    = Math.round(dur * 254016000000);
        track.insertClip(item, insertTicks);

        for (var i = 0; i < track.clips.numItems; i++) {
            var c = track.clips[i];
            if (Math.abs(c.start.seconds - sec) < 0.1) {
                c.end.ticks = (insertTicks + durTicks).toString();
                break;
            }
        }
        return JSON.stringify({ success: true, freezePath: tempPath });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ─── MARKERS ─────────────────────────────────────────────────────────────────

function addMarker(seconds, label, comment, colorIndex) {
    try {
        var seq  = app.project.activeSequence;
        var mark = seq.markers.createMarker(parseFloat(seconds));
        mark.name     = label || "MemeCut";
        mark.comments = comment || "";
        mark.colorByIndex = parseInt(colorIndex) || 0;
        return JSON.stringify({ success: true, id: mark.guid });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

function getAllMarkers() {
    try {
        var seq = app.project.activeSequence;
        var result = [];
        var m = seq.markers.getFirstMarker();
        while (m) {
            result.push({ time: m.start.seconds, name: m.name, comment: m.comments, color: m.colorByIndex });
            m = seq.markers.getNextMarker(m);
        }
        return JSON.stringify(result);
    } catch(e) { return JSON.stringify([]); }
}

// ─── KEYFRAMES / ZOOM ────────────────────────────────────────────────────────

function addZoomKeyframes(clipStartSeconds, peakSeconds, clipEndSeconds, trackIndex, zoomAmount) {
    try {
        var seq   = app.project.activeSequence;
        var track = seq.videoTracks[parseInt(trackIndex) || 0];
        var peak  = parseFloat(peakSeconds);
        var zoom  = parseFloat(zoomAmount) || 1.15;

        for (var i = 0; i < track.clips.numItems; i++) {
            var c = track.clips[i];
            if (c.start.seconds <= peak && c.end.seconds >= peak) {
                var effect = null;
                for (var e = 0; e < c.components.numItems; e++) {
                    if (c.components[e].displayName === "Motion") { effect = c.components[e]; break; }
                }
                if (!effect) return JSON.stringify({ error: "No motion effect" });

                var scaleParam = null;
                for (var p = 0; p < effect.properties.numItems; p++) {
                    if (effect.properties[p].displayName === "Scale") { scaleParam = effect.properties[p]; break; }
                }
                if (!scaleParam) return JSON.stringify({ error: "No scale param" });

                var t0 = Math.round(c.start.seconds * 254016000000).toString();
                var t1 = Math.round(peak            * 254016000000).toString();
                var t2 = Math.round(c.end.seconds   * 254016000000).toString();

                scaleParam.addKey(t0); scaleParam.setValueAtKey(t0, 100, 0);
                scaleParam.addKey(t1); scaleParam.setValueAtKey(t1, Math.round(zoom * 100), 0);
                scaleParam.addKey(t2); scaleParam.setValueAtKey(t2, 100, 0);
                return JSON.stringify({ success: true });
            }
        }
        return JSON.stringify({ error: "Clip not found at time" });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ─── CAPTIONS / TEXT LAYERS ──────────────────────────────────────────────────

function insertCaptionClip(text, startSeconds, endSeconds, trackIndex, fontName, fontSize, colorHex, yPosition) {
    try {
        var seq   = app.project.activeSequence;
        var start = parseFloat(startSeconds);
        var end   = parseFloat(endSeconds);
        var ti    = parseInt(trackIndex) || 2;

        while (seq.videoTracks.numTracks <= ti) seq.videoTracks.addTrack();

        var title = app.project.createNewTitle(text, "Caption_" + Math.round(start * 100));
        if (!title) return JSON.stringify({ error: "Failed to create title" });

        var titleObj = title.getTitleObject();
        titleObj.fontName  = fontName  || "Arial";
        titleObj.fontSize  = parseInt(fontSize) || 72;
        titleObj.fillColor = colorHex || "#FFFFFF";
        titleObj.shadowColor  = "#000000";
        titleObj.shadowOffset = 4;
        titleObj.shadowBlur   = 8;

        var track = seq.videoTracks[ti];
        var startTicks = Math.round(start * 254016000000);
        var endTicks   = Math.round(end   * 254016000000);
        track.insertClip(title, startTicks);

        for (var i = 0; i < track.clips.numItems; i++) {
            var c = track.clips[i];
            if (Math.abs(c.start.seconds - start) < 0.1) { c.end.ticks = endTicks.toString(); break; }
        }
        return JSON.stringify({ success: true });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ─── AUDIO DUCKING ───────────────────────────────────────────────────────────

function setAudioTrackVolume(trackIndex, volumeDb) {
    try {
        var seq   = app.project.activeSequence;
        var track = seq.audioTracks[parseInt(trackIndex)];
        for (var i = 0; i < track.clips.numItems; i++) {
            var c = track.clips[i];
            for (var e = 0; e < c.components.numItems; e++) {
                var comp = c.components[e];
                if (comp.displayName === "Volume") {
                    for (var p = 0; p < comp.properties.numItems; p++) {
                        if (comp.properties[p].displayName === "Level") {
                            comp.properties[p].setValue(parseFloat(volumeDb), true);
                        }
                    }
                }
            }
        }
        return JSON.stringify({ success: true });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ─── EFFECTS ─────────────────────────────────────────────────────────────────

function applyEffectToClip(trackIndex, clipIndex, effectName) {
    try {
        var qeSeq   = qe.project.getActiveSequence();
        var qeTrack = qeSeq.getVideoTrackAt(parseInt(trackIndex));
        var qeClip  = qeTrack.getItemAt(parseInt(clipIndex));
        qeClip.addVideoEffect(qe.project.getVideoEffectByName(effectName));
        return JSON.stringify({ success: true });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ─── FILE SYSTEM (via ExtendScript) ──────────────────────────────────────────

function getFolderContents(folderPath) {
    try {
        var f = new Folder(folderPath);
        if (!f.exists) return JSON.stringify([]);
        var files = f.getFiles(/\.(gif|mp4|mov|avi|png|jpg|jpeg|webp|mp3|wav|m4a)$/i);
        var result = [];
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            result.push({
                path: file.fsName,
                name: file.name,
                type: /\.(mp3|wav|m4a)$/i.test(file.name) ? "audio" :
                      /\.(mp4|mov|avi)$/i.test(file.name) ? "video" : "image"
            });
        }
        return JSON.stringify(result);
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

function getFolderDialog() {
    try {
        var f = Folder.selectDialog("Select Meme Folder");
        return f ? f.fsName : "null";
    } catch(e) { return "null"; }
}

// getFileDialog kept for legacy compatibility but NO LONGER USED in main flow
function getFileDialog() {
    try {
        var f = File.openDialog("Select Media File", "Media:*.mp4,*.mov,*.gif,*.mp3,*.wav,*.png,*.jpg");
        return f ? f.fsName : "null";
    } catch(e) { return "null"; }
}

// ─── PROJECT EXPORT ──────────────────────────────────────────────────────────

function getProjectPath() {
    try { return app.project.path; } catch(e) { return ""; }
}

function saveProject() {
    try { app.project.save(); return "ok"; } catch(e) { return "error:" + e; }
}

// ─── SHORTS: REFRAME ─────────────────────────────────────────────────────────

function createSquareSequence(sourceSeqName) {
    try {
        var seq  = app.project.activeSequence;
        var dupe = seq.clone();
        dupe.name = (sourceSeqName || seq.name) + "_9x16";
        return JSON.stringify({ success: true, name: dupe.name });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

// ─── EXPORT ──────────────────────────────────────────────────────────────────

/**
 * exportSequence()
 * Triggers the Premiere "Export Media" dialog for the active sequence.
 * Opens the native Adobe Media Encoder queue with the current sequence.
 */
function exportSequence() {
    try {
        app.encoder.encodeSequence(
            app.project.activeSequence,
            app.project.path.replace(/[^/\\]*$/, '') + "MemeCut_Export.mp4",
            "H.264",
            app.encoder.ENCODE_ENTIRE,
            true // open in AME queue = true
        );
        return JSON.stringify({ success: true });
    } catch(e) {
        // Fallback: just trigger the native export dialog via command
        try {
            app.executeCommand(app.commandIDs.exportMedia);
            return JSON.stringify({ success: true, method: "dialog" });
        } catch(e2) {
            return JSON.stringify({ error: e2.toString() });
        }
    }
}

/**
 * setInOutFromRange(startSec, endSec)
 * Sets the sequence in/out points to the given range.
 * Used before export to isolate a specific short/clip for export.
 */
function setInOutFromRange(startSec, endSec) {
    try {
        var seq = app.project.activeSequence;
        var inTicks  = Math.round(parseFloat(startSec) * 254016000000);
        var outTicks = Math.round(parseFloat(endSec)   * 254016000000);
        seq.setInPoint(inTicks.toString());
        seq.setOutPoint(outTicks.toString());
        return JSON.stringify({ success: true, inPoint: startSec, outPoint: endSec });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}

/**
 * clearInOut()
 * Clears sequence in/out points.
 */
function clearInOut() {
    try {
        var seq = app.project.activeSequence;
        seq.clearInPoint();
        seq.clearOutPoint();
        return JSON.stringify({ success: true });
    } catch(e) { return JSON.stringify({ error: e.toString() }); }
}
