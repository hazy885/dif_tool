(function() {
    'use strict';

    var MAX_FILE_SIZE = 10 * 1024 * 1024;
    var ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    var ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

    var els = {
        fileInputA: document.getElementById('file_a'),
        fileInputB: document.getElementById('file_b'),
        dropZoneA: document.getElementById('drop_zone_a'),
        dropZoneB: document.getElementById('drop_zone_b'),
        fileNameA: document.getElementById('file_name_a'),
        fileNameB: document.getElementById('file_name_b'),
        fileSizeA: document.getElementById('file_size_a'),
        fileSizeB: document.getElementById('file_size_b'),
        removeButtonA: document.getElementById('remove_a'),
        removeButtonB: document.getElementById('remove_b'),
        compareButton: document.getElementById('compare_btn'),
        compareHint: document.getElementById('compare_hint'),
        errorBox: document.getElementById('error'),
        errorText: document.getElementById('error_text'),
        resultsSection: document.getElementById('results_section'),
        resultsContainer: document.getElementById('results'),
        countUnchanged: document.getElementById('count_unchanged'),
        countAdded: document.getElementById('count_added'),
        countRemoved: document.getElementById('count_removed'),
        countModified: document.getElementById('count_modified'),
        floatingNav: document.getElementById('floating_nav'),
        prevButton: document.getElementById('prev_btn'),
        nextButton: document.getElementById('next_btn'),
        positionText: document.getElementById('position'),
        exportButton: document.getElementById('export_btn')
    };

    var visibleChanges = [];
    var currentIdx = -1;

    function formatSize(bytes) {
        if (bytes === 0) return '0 B';
        var units = ['B', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
    }

    function isValidFile(file) {
        var name = file.name.toLowerCase();
        return ALLOWED_EXTENSIONS.some(function(ext) { return name.endsWith(ext); }) ||
               ALLOWED_TYPES.indexOf(file.type) !== -1;
    }

    function getCsrfToken() {
        var match = document.cookie.match(/csrftoken=([^;]+)/);
        return match ? match[1] : '';
    }

    function showError(msg) {
        els.errorText.textContent = msg;
        els.errorBox.hidden = false;
    }

    function hideError() {
        els.errorBox.hidden = true;
    }

    function updateDropZone(zone, input, nameEl, sizeEl) {
        var file = input.files[0];
        if (file) {
            zone.classList.add('has-file');
            nameEl.textContent = file.name;
            sizeEl.textContent = formatSize(file.size);
        } else {
            zone.classList.remove('has-file');
            nameEl.textContent = '';
            sizeEl.textContent = '';
        }
        updateCompareButton();
    }

    function handleFile(zone, input, nameEl, sizeEl, file) {
        hideError();

        if (!isValidFile(file)) {
            showError('Please select a PDF or DOCX file.');
            return false;
        }
        if (file.size > MAX_FILE_SIZE) {
            showError('File is too large. Maximum size is 10MB.');
            return false;
        }

        try {
            var dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
        } catch (e) {}

        updateDropZone(zone, input, nameEl, sizeEl);
        return true;
    }

    function removeFile(zone, input, nameEl, sizeEl) {
        input.value = '';
        updateDropZone(zone, input, nameEl, sizeEl);
    }

    function updateCompareButton() {
        var hasA = els.fileInputA.files.length > 0;
        var hasB = els.fileInputB.files.length > 0;
        els.compareButton.disabled = !(hasA && hasB);

        if (hasA && hasB) {
            els.compareHint.classList.add('hidden');
        } else {
            els.compareHint.classList.remove('hidden');
            els.compareHint.textContent = !hasA && !hasB ? 'Select both documents to compare' :
                                          !hasA ? 'Select the original document' : 'Select the modified document';
        }
    }

    function setupDropZone(zone, input, nameEl, sizeEl) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function(evt) {
            zone.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); });
        });

        ['dragenter', 'dragover'].forEach(function(evt) {
            zone.addEventListener(evt, function() { zone.classList.add('drag-over'); });
        });

        ['dragleave', 'drop'].forEach(function(evt) {
            zone.addEventListener(evt, function() { zone.classList.remove('drag-over'); });
        });

        zone.addEventListener('drop', function(e) {
            if (e.dataTransfer.files.length) {
                handleFile(zone, input, nameEl, sizeEl, e.dataTransfer.files[0]);
            }
        });

        input.addEventListener('change', function() {
            var file = this.files[0];
            if (!file) return;

            if (!isValidFile(file)) {
                showError('Please select a PDF or DOCX file.');
                this.value = '';
                return;
            }
            if (file.size > MAX_FILE_SIZE) {
                showError('File is too large. Maximum size is 10MB.');
                this.value = '';
                return;
            }
            hideError();
            updateDropZone(zone, input, nameEl, sizeEl);
        });
    }

    function setLoading(loading) {
        els.compareButton.classList.toggle('loading', loading);
        els.compareButton.disabled = loading;
        if (!loading) updateCompareButton();
    }

    function compare() {
        var fileA = els.fileInputA.files[0];
        var fileB = els.fileInputB.files[0];
        if (!fileA || !fileB) {
            showError('Please select both documents.');
            return;
        }

        hideError();
        setLoading(true);
        els.resultsSection.hidden = true;
        els.floatingNav.hidden = true;
        els.resultsContainer.innerHTML = '';

        var form = new FormData();
        form.append('file_a', fileA);
        form.append('file_b', fileB);

        fetch('/api/compare/', {
            method: 'POST',
            headers: { 'X-CSRFToken': getCsrfToken() },
            body: form
        })
        .then(function(res) {
            return res.json().then(function(data) { return { ok: res.ok, data: data }; });
        })
        .then(function(res) {
            setLoading(false);
            if (!res.ok || res.data.error) {
                showError(res.data.error || 'Something went wrong.');
                return;
            }
            renderResults(res.data);
            els.resultsSection.hidden = false;
            els.floatingNav.hidden = false;
            initNav();
            els.resultsSection.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(function(err) {
            setLoading(false);
            showError('Failed to compare documents. Please try again.');
            console.error(err);
        });
    }

    function renderResults(data) {
        var counts = { unchanged: 0, added: 0, removed: 0, modified: 0 };
        data.diff.forEach(function(d) { counts[d.status]++; });

        els.countUnchanged.textContent = counts.unchanged;
        els.countAdded.textContent = counts.added;
        els.countRemoved.textContent = counts.removed;
        els.countModified.textContent = counts.modified;

        var html = '<div class="diff-headers">' +
            '<div class="diff-title">' + esc(data.document_a.name) + '</div>' +
            '<div class="diff-title">' + esc(data.document_b.name) + '</div></div>';

        data.diff.forEach(function(d) {
            html += '<div class="diff-item diff-' + d.status + '">' +
                '<div class="diff-cell"><p>' + formatText(d.text_a, d.status, 'a') + '</p></div>' +
                '<div class="diff-cell"><p>' + formatText(d.text_b, d.status, 'b') + '</p></div></div>';
        });

        els.resultsContainer.innerHTML = html;
    }

    function esc(text) {
        if (!text) return '';
        var el = document.createElement('div');
        el.textContent = text;
        return el.innerHTML;
    }

    function formatText(text, status, side) {
        if (!text) return '';
        if (status === 'modified') {
            return text.replace(/<mark>/g, '<span class="highlight">').replace(/<\/mark>/g, '</span>');
        }
        if (status === 'added' && side === 'b') return '<span class="added">' + text + '</span>';
        if (status === 'removed' && side === 'a') return '<span class="removed">' + text + '</span>';
        return text;
    }

    function applyFilters() {
        document.querySelectorAll('.filter-cb').forEach(function(cb) {
            var items = document.querySelectorAll('.diff-' + cb.value);
            var label = cb.closest('.filter-chip');
            if (label) label.classList.toggle('inactive', !cb.checked);
            items.forEach(function(el) { el.style.display = cb.checked ? '' : 'none'; });
        });
        initNav();
    }

    function initNav() {
        visibleChanges = [];
        document.querySelectorAll('.diff-added, .diff-removed, .diff-modified').forEach(function(el) {
            if (el.style.display !== 'none') visibleChanges.push(el);
        });
        currentIdx = -1;
        updatePosition();
        document.querySelectorAll('.diff-item.active').forEach(function(el) { el.classList.remove('active'); });
    }

    function updatePosition() {
        var curr = visibleChanges.length ? currentIdx + 1 : 0;
        els.positionText.textContent = curr + ' of ' + visibleChanges.length;
    }

    function goTo(idx) {
        if (!visibleChanges.length) return;
        if (idx < 0) idx = visibleChanges.length - 1;
        if (idx >= visibleChanges.length) idx = 0;

        currentIdx = idx;
        document.querySelectorAll('.diff-item.active').forEach(function(el) { el.classList.remove('active'); });
        visibleChanges[idx].classList.add('active');
        visibleChanges[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
        updatePosition();
    }

    function exportResults() {
        var content = els.resultsContainer.innerHTML;
        var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
            '<title>Comparison Report</title><style>' +
            '*{box-sizing:border-box;margin:0;padding:0}' +
            'body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:32px;background:#f5f5f5}' +
            'h1{font-size:24px;margin-bottom:8px}.date{color:#666;font-size:14px;margin-bottom:24px}' +
            '.results{background:#fff;border:1px solid #ddd;border-radius:8px;overflow:hidden}' +
            '.diff-headers{display:flex;background:#333;color:#fff;font-weight:600}' +
            '.diff-title{flex:1;padding:12px 16px}.diff-title+.diff-title{border-left:1px solid #555}' +
            '.diff-item{display:flex;border-bottom:1px solid #eee}' +
            '.diff-cell{flex:1;padding:12px 16px;line-height:1.6}.diff-cell+.diff-cell{border-left:1px solid #eee}' +
            '.diff-cell p{margin:0}.highlight{background:#fff3cd;padding:2px 4px;border-radius:3px}' +
            '.added{background:#d4edda;color:#155724;padding:2px 4px;border-radius:3px}' +
            '.removed{background:#f8d7da;color:#721c24;padding:2px 4px;border-radius:3px;text-decoration:line-through}' +
            '.diff-added .diff-cell:first-child{background:#f8f8f8;color:#999}' +
            '.diff-added .diff-cell:last-child{background:#f0fff0}' +
            '.diff-removed .diff-cell:first-child{background:#fff0f0}' +
            '.diff-removed .diff-cell:last-child{background:#f8f8f8;color:#999}' +
            '.diff-modified .diff-cell:first-child{background:#fffdf0}' +
            '.diff-modified .diff-cell:last-child{background:#f0fff0}' +
            '</style></head><body><h1>Comparison Report</h1>' +
            '<p class="date">' + new Date().toLocaleString() + '</p>' +
            '<div class="results">' + content + '</div></body></html>';

        var blob = new Blob([html], { type: 'text/html' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'comparison-report.html';
        link.click();
        setTimeout(function() { URL.revokeObjectURL(link.href); }, 1000);
    }

    function onKey(e) {
        if (els.resultsSection.hidden) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        var key = e.key.toLowerCase();
        if (key === 'arrowup' || key === 'k') { e.preventDefault(); goTo(currentIdx - 1); }
        if (key === 'arrowdown' || key === 'j') { e.preventDefault(); goTo(currentIdx + 1); }
    }

    function init() {
        setupDropZone(els.dropZoneA, els.fileInputA, els.fileNameA, els.fileSizeA);
        setupDropZone(els.dropZoneB, els.fileInputB, els.fileNameB, els.fileSizeB);

        els.removeButtonA.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            removeFile(els.dropZoneA, els.fileInputA, els.fileNameA, els.fileSizeA);
        });
        els.removeButtonB.addEventListener('click', function(e) {
            e.preventDefault(); e.stopPropagation();
            removeFile(els.dropZoneB, els.fileInputB, els.fileNameB, els.fileSizeB);
        });

        els.compareButton.addEventListener('click', compare);
        els.prevButton.addEventListener('click', function() { goTo(currentIdx - 1); });
        els.nextButton.addEventListener('click', function() { goTo(currentIdx + 1); });
        els.exportButton.addEventListener('click', exportResults);

        document.querySelectorAll('.filter-cb').forEach(function(cb) {
            cb.addEventListener('change', applyFilters);
        });

        document.addEventListener('keydown', onKey);
        updateCompareButton();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
