
/**
 * MessageRenderer - ماژول حرفه‌ای برای نمایش پیام‌های هوش مصنوعی
 * ویژگی‌ها: Markdown، Syntax Highlighting، Typewriter Effect، Copy Code، Math Formulas
 * نسخه 2.0 - با معماری بهبود یافته برای جلوگیری از تداخل‌ها
 */

class MessageRenderer {
    constructor() {
        this.setupStyles();
        this.initMarkdownParser();
        this.placeholderCounter = 0;
    }

    // تولید UUID یکتا برای placeholders
    generateUUID() {
        this.placeholderCounter++;
        return `UUID_${Date.now()}_${this.placeholderCounter}_${Math.random().toString(36).substr(2, 9)}`;
    }

    initMarkdownParser() {
        this.simpleMarkdown = {
            parse: (text) => {
                // Storage برای نگهداری محتوای استخراج شده
                const storage = {
                    codeBlocks: new Map(),
                    tables: new Map(),
                    displayMath: new Map(),
                    inlineMath: new Map()
                };

                let processedText = text;

                // **مرحله 1: استخراج Code Blocks (بالاترین اولویت)**
                processedText = this.extractCodeBlocks(processedText, storage);

                // **مرحله 2: استخراج Tables**
                processedText = this.extractTables(processedText, storage);

                // **مرحله 3: استخراج Display Math**
                // $$...$$
                processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
                    const uuid = this.generateUUID();
                    storage.displayMath.set(uuid, formula.trim());
                    return uuid;
                });

                // \[...\]
                processedText = processedText.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => {
                    const uuid = this.generateUUID();
                    storage.displayMath.set(uuid, formula.trim());
                    return uuid;
                });

                // **مرحله 4: استخراج Inline Math**
                // \(...\)
                processedText = processedText.replace(/\\\(([\s\S]+?)\\\)/g, (match, formula) => {
                    const uuid = this.generateUUID();
                    storage.inlineMath.set(uuid, formula.trim());
                    return uuid;
                });

                // $...$ با دقت
                processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
                    if (match.startsWith('$$') || match.endsWith('$$')) {
                        return match;
                    }

                    if (formula.match(/[a-zA-Z\\{}()[\]^_=+\-*\/]/)) {
                        const uuid = this.generateUUID();
                        storage.inlineMath.set(uuid, formula.trim());
                        return uuid;
                    }
                    return match;
                });

                // **مرحله 5: پردازش Basic Markdown**
                processedText = this.parseBasicMarkdown(processedText);

                // **مرحله 6: بازگرداندن همه placeholders**
                processedText = this.restoreAllPlaceholders(processedText, storage);

                return processedText;
            }
        };
    }

    extractCodeBlocks(text, storage) {
        return text.replace(/```([a-z]*)\n([\s\S]*?)```/gim, (match, lang, code) => {
            const uuid = this.generateUUID();
            // Escape کامل محتوا قبل از ذخیره
            storage.codeBlocks.set(uuid, {
                lang: lang || 'text',
                code: this.escapeHtml(code)
            });
            return uuid;
        });
    }

    extractTables(text, storage) {
        const tableRegex = /(\|.+\|(?:[\r\n]+|$))(\|[\s]*:?-+:?[\s]*(?:\|[\s]*:?-+:?[\s]*)+\|(?:[\r\n]+|$))((?:\|.+\|(?:[\r\n]+|$))*)/gm;

        return text.replace(tableRegex, (match, header, separator, rows) => {
            const uuid = this.generateUUID();

            const alignments = this.parseTableAlignments(separator);
            const columnCount = alignments.length;

            const headerCells = this.parseTableRow(header);
            while (headerCells.length < columnCount) {
                headerCells.push('');
            }

            const bodyRows = rows
                .split(/[\r\n]+/)
                .map(row => row.trim())
                .filter(row => row && row.startsWith('|'))
                .map(row => {
                    const cells = this.parseTableRow(row);
                    while (cells.length < columnCount) {
                        cells.push('');
                    }
                    return cells.slice(0, columnCount);
                });

            const tableHtml = this.buildTableHtml(headerCells.slice(0, columnCount), bodyRows, alignments);
            storage.tables.set(uuid, tableHtml);

            return uuid;
        });
    }

    parseBasicMarkdown(text) {
        return text
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]*)`/g, '<code>$1</code>')
            .replace(/\[([^\]]*)\]\(([^\)]*)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/\n/g, '<br>');
    }

    restoreAllPlaceholders(text, storage) {
        let result = text;

        // بازگرداندن Code Blocks
        storage.codeBlocks.forEach((block, uuid) => {
            const html = `<pre><code class="language-${block.lang}">${block.code}</code></pre>`;
            result = result.replace(uuid, html);
        });

        // بازگرداندن Display Math
        storage.displayMath.forEach((formula, uuid) => {
            const escapedForAttr = this.escapeHtml(formula);
            const html = `<div class="katex-display-container" data-math="${escapedForAttr}"></div>`;
            result = result.replace(uuid, html);
        });

        // بازگرداندن Inline Math
        storage.inlineMath.forEach((formula, uuid) => {
            const escapedForAttr = this.escapeHtml(formula);
            const html = `<span class="katex-inline-container" data-math="${escapedForAttr}"></span>`;
            result = result.replace(uuid, html);
        });

        // بازگرداندن Tables
        storage.tables.forEach((tableHtml, uuid) => {
            result = result.replace(uuid, tableHtml);
        });

        return result;
    }

    parseTableAlignments(separator) {
        let cleanSep = separator.trim();
        if (cleanSep.startsWith('|')) cleanSep = cleanSep.substring(1);
        if (cleanSep.endsWith('|')) cleanSep = cleanSep.substring(0, cleanSep.length - 1);
        
        return cleanSep.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0)
            .map(cell => {
                const trimmed = cell.trim();
                if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center';
                if (trimmed.endsWith(':')) return 'right';
                return 'left';
            });
    }

    parseTableRow(row) {
        let cleanRow = row.trim();
        if (cleanRow.startsWith('|')) cleanRow = cleanRow.substring(1);
        if (cleanRow.endsWith('|')) cleanRow = cleanRow.substring(0, cleanRow.length - 1);
        
        return cleanRow.split('|').map(cell => cell.trim());
    }

    buildTableHtml(headerCells, bodyRows, alignments) {
        let html = '<div class="table-container"><table class="markdown-table">';

        html += '<thead><tr>';
        headerCells.forEach((cell, i) => {
            const align = alignments[i] || 'left';
            const content = cell.trim() ? this.parseInlineMarkdown(cell) : '&nbsp;';
            html += `<th style="text-align: ${align}">${content}</th>`;
        });
        html += '</tr></thead>';

        html += '<tbody>';
        bodyRows.forEach((row, rowIndex) => {
            html += `<tr class="${rowIndex % 2 === 0 ? 'even-row' : 'odd-row'}">`;
            row.forEach((cell, i) => {
                const align = alignments[i] || 'left';
                const content = cell.trim() ? this.parseInlineMarkdown(cell) : '&nbsp;';
                html += `<td style="text-align: ${align}">${content}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';

        html += '</table></div>';
        return html;
    }

    parseInlineMarkdown(text) {
        const mathStorage = new Map();

        // استخراج Math فقط برای جداول
        let processedText = text.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
            if (match.startsWith('$$') || match.endsWith('$$')) {
                return match;
            }
            if (formula.match(/[a-zA-Z\\{}()[\]^_=+\-*\/]/)) {
                const uuid = this.generateUUID();
                mathStorage.set(uuid, formula.trim());
                return uuid;
            }
            return match;
        });

        processedText = processedText.replace(/\\\(([^\)]+?)\\\)/g, (match, formula) => {
            const uuid = this.generateUUID();
            mathStorage.set(uuid, formula.trim());
            return uuid;
        });

        // پردازش Markdown
        processedText = processedText
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]*)`/g, '<code>$1</code>')
            .replace(/\[([^\]]*)\]\(([^\)]*)\)/g, '<a href="$2" target="_blank">$1</a>');

        // بازگرداندن Math
        mathStorage.forEach((formula, uuid) => {
            const escapedForAttr = this.escapeHtml(formula);
            processedText = processedText.replace(
                uuid,
                `<span class="katex-inline-container table-math" data-math="${escapedForAttr}"></span>`
            );
        });

        return processedText;
    }

    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .message-content {
                line-height: 1.6;
                color: #e5e5e5;
            }

            .message-content h1, .message-content h2, .message-content h3 {
                color: #007BFF;
                margin: 16px 0 8px 0;
                font-weight: 600;
            }

            .message-content h1 { font-size: 1.5em; }
            .message-content h2 { font-size: 1.3em; }
            .message-content h3 { font-size: 1.1em; }

            .message-content p {
                margin: 8px 0;
            }

            .message-content code {
                background: rgba(0, 123, 255, 0.15);
                padding: 3px 8px;
                border-radius: 4px;
                font-family: 'JetBrains Mono', 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
                font-size: 1em;
                color: #00d4ff;
                direction: ltr;
                text-align: left;
                display: inline-block;
                font-weight: 500;
            }

            .message-content pre {
                background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3a 100%);
                border: 1px solid rgba(0, 123, 255, 0.3);
                border-radius: 8px;
                padding: 16px;
                margin: 12px 0;
                overflow-x: auto;
                position: relative;
                direction: ltr;
                text-align: left;
            }

            .message-content pre code {
                background: none;
                padding: 0;
                color: inherit;
                font-size: 0.95em;
                display: block;
                line-height: 1.6;
                direction: ltr;
                text-align: left;
                white-space: pre;
                font-family: 'JetBrains Mono', 'SF Mono', 'Monaco', 'Cascadia Code', 'Consolas', monospace;
                font-weight: 400;
            }

            .code-copy-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(0, 123, 255, 0.8);
                border: none;
                border-radius: 6px;
                color: white;
                padding: 6px 12px;
                font-size: 12px;
                cursor: pointer;
                opacity: 1;
                transition: all 0.3s ease;
                font-family: 'Vazirmatn', sans-serif;
                font-weight: 500;
                box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
            }

            .code-copy-btn:hover {
                background: rgba(0, 123, 255, 1);
                transform: scale(1.05);
            }

            .code-copy-btn.copied {
                background: #28a745;
            }

            .typewriter-cursor {
                display: inline-block;
                background-color: #007BFF;
                width: 2px;
                height: 1.2em;
                animation: blink 1s infinite;
                margin-right: 2px;
            }

            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }

            .message-content a {
                color: #007BFF;
                text-decoration: none;
                border-bottom: 1px solid transparent;
                transition: all 0.3s ease;
            }

            .message-content a:hover {
                border-bottom-color: #007BFF;
                color: #00d4ff;
            }

            .katex-display-container,
            .katex-inline-container {
                color: #ff6b6b;
                font-family: 'Courier New', monospace;
            }

            .message-content .katex-display,
            .message-content .katex-display-container.rendered {
                margin: 20px 0;
                padding: 20px;
                background: linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 100%);
                border: 2px solid rgba(0, 123, 255, 0.4);
                border-radius: 12px;
                box-shadow:
                    0 4px 15px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                text-align: center;
                overflow-x: auto;
                direction: ltr;
                position: relative;
            }

            .message-content .katex-display::before,
            .message-content .katex-display-container.rendered::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(0, 123, 255, 0.05) 0%, rgba(0, 123, 255, 0.1) 100%);
                border-radius: 10px;
                pointer-events: none;
            }

            .message-content .katex-display .katex,
            .message-content .katex-display-container.rendered .katex {
                color: #ffffff;
                font-size: 1.3em;
                position: relative;
                z-index: 1;
            }

            .message-content .katex-inline,
            .message-content .katex-inline-container.rendered {
                display: inline-block;
                margin: 4px 6px;
                padding: 8px 12px;
                background: linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 100%);
                border: 2px solid rgba(0, 123, 255, 0.4);
                border-radius: 8px;
                box-shadow:
                    0 2px 8px rgba(0, 0, 0, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                position: relative;
                direction: ltr;
                text-align: center;
            }

            .message-content .katex-inline::before,
            .message-content .katex-inline-container.rendered::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(0, 123, 255, 0.05) 0%, rgba(0, 123, 255, 0.1) 100%);
                border-radius: 6px;
                pointer-events: none;
            }

            .message-content .katex-inline .katex,
            .message-content .katex-inline-container.rendered .katex {
                color: #ffffff;
                font-size: 1.1em;
                position: relative;
                z-index: 1;
            }

            .message-content .katex .mord,
            .message-content .katex .mop,
            .message-content .katex .mrel,
            .message-content .katex .mbin,
            .message-content .katex .mpunct {
                color: #e5e5e5;
            }

            .message-content .katex .mop {
                color: #00d4ff;
            }

            .message-content .katex .mrel {
                color: #ff6b6b;
            }

            .message-content .katex .mbin {
                color: #4ecdc4;
            }

            .message-content .katex .sqrt {
                border-color: #007BFF;
            }

            .message-content .katex .frac-line {
                border-bottom-color: #007BFF;
            }

            .katex-display-container:not(.rendered),
            .katex-inline-container:not(.rendered) {
                background: rgba(255, 107, 107, 0.1);
                border: 1px solid rgba(255, 107, 107, 0.3);
                color: #ff6b6b;
                padding: 8px 12px;
                border-radius: 8px;
                direction: ltr;
                font-family: 'Courier New', monospace;
                font-size: 0.9em;
            }

            .message-content .table-container {
                margin: 20px 0;
                overflow-x: auto;
                background: linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 100%);
                border: 2px solid rgba(0, 123, 255, 0.4);
                border-radius: 12px;
                box-shadow:
                    0 4px 15px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
                position: relative;
                direction: ltr;
                animation: tableSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .message-content .table-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(135deg, rgba(0, 123, 255, 0.05) 0%, rgba(0, 123, 255, 0.1) 100%);
                border-radius: 10px;
                pointer-events: none;
            }

            .message-content .markdown-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0;
                position: relative;
                z-index: 1;
                font-family: 'Vazirmatn', sans-serif;
            }

            .message-content .markdown-table thead {
                background: linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 100%);
                position: sticky;
                top: 0;
                z-index: 2;
            }

            .message-content .markdown-table th {
                padding: 16px 20px;
                font-weight: 700;
                font-size: 0.95em;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #00d4ff;
                border-bottom: 3px solid rgba(0, 123, 255, 0.6);
                white-space: nowrap;
                background: linear-gradient(135deg, rgba(0, 123, 255, 0.15) 0%, rgba(0, 123, 255, 0.25) 100%);
                text-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
            }

            .message-content .markdown-table th:first-child {
                border-top-left-radius: 8px;
            }

            .message-content .markdown-table th:last-child {
                border-top-right-radius: 8px;
            }

            .message-content .markdown-table td {
                padding: 14px 20px;
                color: #e5e5e5;
                border-bottom: 1px solid rgba(0, 123, 255, 0.15);
                line-height: 1.6;
                transition: all 0.3s ease;
            }

            .message-content .markdown-table tbody tr {
                transition: all 0.3s ease;
            }

            .message-content .markdown-table tbody tr.even-row {
                background: rgba(0, 123, 255, 0.03);
            }

            .message-content .markdown-table tbody tr.odd-row {
                background: rgba(0, 123, 255, 0.01);
            }

            .message-content .markdown-table tbody tr:hover {
                background: rgba(0, 123, 255, 0.15);
                transform: scale(1.01);
                box-shadow: 0 2px 8px rgba(0, 123, 255, 0.2);
            }

            .message-content .markdown-table tbody tr:last-child td {
                border-bottom: none;
            }

            .message-content .markdown-table tbody tr:last-child td:first-child {
                border-bottom-left-radius: 8px;
            }

            .message-content .markdown-table tbody tr:last-child td:last-child {
                border-bottom-right-radius: 8px;
            }

            .message-content .markdown-table code {
                background: rgba(0, 123, 255, 0.2);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: 'JetBrains Mono', monospace;
                font-size: 0.9em;
                color: #00d4ff;
                display: inline;
                direction: ltr;
                text-align: left;
            }

            .message-content .markdown-table .katex-inline-container.table-math {
                display: inline;
                margin: 0 4px;
                padding: 4px 8px;
                background: linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 100%);
                border: 1px solid rgba(0, 123, 255, 0.3);
                border-radius: 6px;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
                position: relative;
                direction: ltr;
                text-align: center;
                vertical-align: middle;
            }

            .message-content .markdown-table .katex-inline-container.table-math.rendered {
                background: linear-gradient(135deg, #1a1a2e 0%, #2a2a3e 100%);
            }

            .message-content .markdown-table .katex-inline-container.table-math .katex {
                color: #ffffff;
                font-size: 1em;
            }

            .message-content .markdown-table a {
                color: #007BFF;
                text-decoration: none;
                border-bottom: 1px solid transparent;
                transition: all 0.3s ease;
            }

            .message-content .markdown-table a:hover {
                border-bottom-color: #007BFF;
                color: #00d4ff;
            }

            @media (max-width: 768px) {
                .message-content .table-container {
                    margin: 16px 0;
                    border-radius: 8px;
                }

                .message-content .markdown-table th,
                .message-content .markdown-table td {
                    padding: 10px 12px;
                    font-size: 0.9em;
                }

                .message-content .markdown-table th {
                    font-size: 0.85em;
                    letter-spacing: 0.5px;
                }
            }

            @keyframes tableSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }

            .message-content .table-container::-webkit-scrollbar {
                height: 8px;
            }

            .message-content .table-container::-webkit-scrollbar-track {
                background: rgba(0, 123, 255, 0.1);
                border-radius: 4px;
            }

            .message-content .table-container::-webkit-scrollbar-thumb {
                background: linear-gradient(90deg, rgba(0, 123, 255, 0.4) 0%, rgba(0, 123, 255, 0.6) 100%);
                border-radius: 4px;
                transition: all 0.3s ease;
            }

            .message-content .table-container::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(90deg, rgba(0, 123, 255, 0.6) 0%, rgba(0, 123, 255, 0.8) 100%);
            }

            .message-section {
                padding: 16px 20px;
                background: linear-gradient(135deg, #1f1f2e 0%, #2a2a3a 100%);
                border: 1px solid rgba(0, 123, 255, 0.2);
                border-radius: 16px;
                border-bottom-left-radius: 4px;
                border-bottom-right-radius: 16px;
                margin-bottom: 12px;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                animation: sectionSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .message-section:last-child {
                margin-bottom: 0;
            }

            .message-sections-container {
                display: flex;
                flex-direction: column;
                align-self: flex-end;
                max-width: 95%;
                margin-left: 2.5%;
                margin-right: 2.5%;
            }

            @keyframes sectionSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
        `;
        document.head.appendChild(style);
    }

    async renderMessage(content, container, options = {}) {
        const {
            typewriter = false,
            typewriterSpeed = 20,
            streaming = false
        } = options;

        if (typewriter && !streaming) {
            return this.renderWithTypewriter(content, container, typewriterSpeed);
        } else {
            return this.renderInstant(content, container);
        }
    }

    async renderInstant(content, container) {
        try {
            const html = this.simpleMarkdown.parse(content);
            container.innerHTML = html;
            container.className += ' message-content';

            this.addCopyButtons(container);
            await this.renderMathFormulas(container);

            return container;
        } catch (error) {
            console.error('خطا در رندر پیام:', error);
            container.innerHTML = this.escapeHtml(content);
            return container;
        }
    }

    async renderWithTypewriter(content, container, speed = 5) {
        try {
            container.className += ' message-content';
            container.innerHTML = '';

            const contentLength = content.length;

            if (contentLength > 500) {
                const shortContent = content.substring(0, 100) + '...';
                await this.fastTypewriter(shortContent, container, 2);

                setTimeout(async () => {
                    const html = this.simpleMarkdown.parse(content);
                    container.innerHTML = html;
                    this.addCopyButtons(container);
                    await this.renderMathFormulas(container);
                }, 200);
            } else if (contentLength > 200) {
                await this.fastTypewriter(content, container, 3);
                const html = this.simpleMarkdown.parse(container.textContent);
                container.innerHTML = html;
                this.addCopyButtons(container);
                await this.renderMathFormulas(container);
            } else {
                await this.fastTypewriter(content, container, speed);
                const html = this.simpleMarkdown.parse(container.textContent);
                container.innerHTML = html;
                this.addCopyButtons(container);
                await this.renderMathFormulas(container);
            }

            return container;
        } catch (error) {
            console.error('خطا در انیمیشن تایپ‌رایتر:', error);
            container.innerHTML = this.escapeHtml(content);
            return container;
        }
    }

    async fastTypewriter(text, container, speed) {
        container.textContent = '';
        const chunkSize = 3;

        for (let i = 0; i < text.length; i += chunkSize) {
            const chunk = text.substring(i, i + chunkSize);
            container.textContent += chunk;
            await new Promise(resolve => setTimeout(resolve, speed));
        }
    }

    addCopyButtons(container) {
        const codeBlocks = container.querySelectorAll('pre');
        codeBlocks.forEach(pre => {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'code-copy-btn';
            copyBtn.textContent = 'کپی';
            copyBtn.onclick = () => this.copyCode(pre, copyBtn);
            pre.style.position = 'relative';
            pre.appendChild(copyBtn);

            const codeElement = pre.querySelector('code');
            if (codeElement) {
                this.applySyntaxHighlighting(codeElement);
            }
        });
    }

    async copyCode(preElement, button) {
        const code = preElement.querySelector('code');
        let text = '';

        if (code) {
            text = code.textContent || code.innerText || '';
        } else {
            text = preElement.textContent || preElement.innerText || '';
        }

        try {
            await navigator.clipboard.writeText(text);
            const originalText = button.textContent;
            button.textContent = 'کپی شد!';
            button.classList.add('copied');
            button.style.background = '#28a745';

            setTimeout(() => {
                button.textContent = originalText;
                button.classList.remove('copied');
                button.style.background = 'rgba(0, 123, 255, 0.8)';
            }, 2000);
        } catch (error) {
            console.error('خطا در کپی:', error);
        }
    }

    async renderPartial(partialContent, container) {
        try {
            if (!container.classList.contains('message-content')) {
                container.className += ' message-content';
            }

            container.textContent = partialContent;

            const cursor = document.createElement('span');
            cursor.className = 'typewriter-cursor';
            container.appendChild(cursor);

            return container;
        } catch (error) {
            console.error('خطا در رندر جزئی:', error);
            container.textContent = partialContent;
            return container;
        }
    }

    async finalizMessage(container) {
        const cursor = container.querySelector('.typewriter-cursor');
        if (cursor) {
            cursor.remove();
        }

        const html = this.simpleMarkdown.parse(container.textContent);
        container.innerHTML = html;

        this.addCopyButtons(container);
        await this.renderMathFormulas(container);

        return container;
    }

    async renderMathFormulas(container) {
        const maxAttempts = 5;
        let attempt = 0;

        const tryRender = async () => {
            attempt++;

            if (typeof katex === 'undefined') {
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    return tryRender();
                } else {
                    console.error('KaTeX بعد از', maxAttempts, 'تلاش لود نشد');
                    return;
                }
            }

            try {
                const katexOptions = {
                    throwOnError: false,
                    errorColor: '#ff6b6b',
                    trust: true,
                    strict: false,
                    displayMode: false,
                    output: 'html',
                    fleqn: false,
                    globalGroup: true,
                    maxSize: 500,
                    maxExpand: 1000,
                    macros: {
                        "\\RR": "\\mathbb{R}",
                        "\\NN": "\\mathbb{N}",
                        "\\ZZ": "\\mathbb{Z}",
                        "\\QQ": "\\mathbb{Q}",
                        "\\CC": "\\mathbb{C}",
                        "\\X": "X"
                    }
                };

                const displayContainers = container.querySelectorAll('.katex-display-container:not(.rendered)');

                for (const displayContainer of displayContainers) {
                    const mathText = displayContainer.getAttribute('data-math') || displayContainer.textContent.trim();
                    if (!mathText) continue;

                    try {
                        displayContainer.innerHTML = '';
                        katex.render(mathText, displayContainer, {
                            ...katexOptions,
                            displayMode: true
                        });
                        displayContainer.classList.add('rendered');
                        displayContainer.classList.add('katex-display');
                    } catch (error) {
                        console.error('خطا در رندر فرمول display:', error.message);
                        displayContainer.innerHTML = `<div style="color: #ff6b6b; font-size: 12px; padding: 8px;">
                            خطا در رندر فرمول: <code style="display: block; margin-top: 4px; direction: ltr;">${this.escapeHtml(mathText)}</code>
                            <br><small>${error.message}</small>
                        </div>`;
                    }
                }

                const inlineContainers = container.querySelectorAll('.katex-inline-container:not(.rendered)');

                for (const inlineContainer of inlineContainers) {
                    const mathText = inlineContainer.getAttribute('data-math') || inlineContainer.textContent.trim();
                    if (!mathText) continue;

                    try {
                        inlineContainer.innerHTML = '';
                        katex.render(mathText, inlineContainer, {
                            ...katexOptions,
                            displayMode: false
                        });
                        inlineContainer.classList.add('rendered');
                        inlineContainer.classList.add('katex-inline');
                    } catch (error) {
                        console.error('خطا در رندر فرمول inline:', error.message);
                        inlineContainer.innerHTML = `<code style="color: #ff6b6b; background: rgba(255, 107, 107, 0.1); padding: 4px 8px; border-radius: 4px; direction: ltr;">${this.escapeHtml(mathText)}<br><small>${error.message}</small></code>`;
                    }
                }

            } catch (error) {
                console.error('خطا در پردازش فرمول‌های ریاضی:', error);
            }
        };

        await new Promise(resolve => setTimeout(resolve, 100));
        await tryRender();
    }

    applySyntaxHighlighting(codeElement) {
        try {
            if (typeof Prism === 'undefined') {
                console.warn('Prism.js یافت نشد');
                return;
            }

            const language = codeElement.className.match(/language-([a-z]+)/)?.[1] || 'javascript';
            codeElement.className = `language-${language}`;
            Prism.highlightElement(codeElement);

        } catch (error) {
            console.warn('خطا در Prism.js:', error);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

window.MessageRenderer = MessageRenderer;
