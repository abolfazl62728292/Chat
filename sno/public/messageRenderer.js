/**
 * MessageRenderer - ماژول حرفه‌ای برای نمایش پیام‌های هوش مصنوعی
 * ویژگی‌ها: Markdown، Syntax Highlighting، Typewriter Effect، Copy Code، Math Formulas
 */

class MessageRenderer {
    constructor() {
        this.setupStyles();
        this.initMarkdownParser();
        this.mathDelimiters = [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false }
        ];
    }

    initMarkdownParser() {
        this.simpleMarkdown = {
            parse: (text) => {
                const placeholders = {
                    code: [],
                    math: []
                };

                let processedText = text;

                // ذخیره فرمول‌های display با اولویت بالا
                // $$...$$
                processedText = processedText.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
                    const id = `ＭＡＴＨＤＩＳＰＬＡＹ${placeholders.math.length}ＥＮＤＭＡＴＨ`;
                    placeholders.math.push({ 
                        type: 'display', 
                        content: formula.trim(),
                        id: id
                    });
                    return id;
                });

                // \[...\]
                processedText = processedText.replace(/\\\[([\s\S]+?)\\\]/g, (match, formula) => {
                    const id = `ＭＡＴＨＤＩＳＰＬＡＹ${placeholders.math.length}ＥＮＤＭＡＴＨ`;
                    placeholders.math.push({ 
                        type: 'display', 
                        content: formula.trim(),
                        id: id
                    });
                    return id;
                });

                // ذخیره فرمول‌های inline
                // \(...\) - باید قبل از $ ... $ پردازش شود
                processedText = processedText.replace(/\\\(([\s\S]+?)\\\)/g, (match, formula) => {
                    const id = `ＭＡＴＨＩＮＬＩＮＥ${placeholders.math.length}ＥＮＤＭＡＴＨ`;
                    placeholders.math.push({ 
                        type: 'inline', 
                        content: formula.trim(),
                        id: id
                    });
                    return id;
                });

                // $...$ با دقت بالا برای جلوگیری از تداخل
                // Pattern جدید که فرمول‌های پیچیده‌تر را پشتیبانی می‌کند
                processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
                    // بررسی اینکه دوتا $$ نیست
                    if (match.startsWith('$$') || match.endsWith('$$')) {
                        return match;
                    }
                    
                    // بررسی اینکه واقعاً فرمول است نه عدد معمولی
                    // الگوهای معتبر: حروف، backslash، براکت‌ها، توان، زیرنویس
                    if (formula.match(/[a-zA-Z\\{}()[\]^_=+\-*\/]/)) {
                        const id = `ＭＡＴＨＩＮＬＩＮＥ${placeholders.math.length}ＥＮＤＭＡＴＨ`;
                        placeholders.math.push({ 
                            type: 'inline', 
                            content: formula.trim(),
                            id: id
                        });
                        return id;
                    }
                    return match;
                });

                // ذخیره code blocks
                processedText = processedText.replace(/```([a-z]*)\n([\s\S]*?)```/gim, (match, lang, code) => {
                    const id = `ＣＯＤＥＢＬＯＣＫ${placeholders.code.length}ＥＮＤＣＯＤＥ`;
                    placeholders.code.push({ 
                        lang: lang || 'text', 
                        code: code,
                        id: id
                    });
                    return id;
                });

                // پردازش Markdown
                processedText = processedText
                    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`([^`]*)`/g, '<code>$1</code>')
                    .replace(/\[([^\]]*)\]\(([^\)]*)\)/g, '<a href="$2" target="_blank">$1</a>')
                    .replace(/\n/g, '<br>');

                // بازگرداندن code blocks
                placeholders.code.forEach((block) => {
                    processedText = processedText.replace(
                        block.id,
                        `<pre><code class="language-${block.lang}">${this.escapeHtml(block.code)}</code></pre>`
                    );
                });

                // بازگرداندن فرمول‌های ریاضی
                placeholders.math.forEach((math) => {
                    // برای data attribute از escapeHtml استفاده می‌کنیم
                    // اما محتوای داخلی را خام نگه می‌داریم تا KaTeX بتواند آن را پردازش کند
                    const escapedForAttr = this.escapeHtml(math.content);
                    
                    if (math.type === 'display') {
                        processedText = processedText.replace(
                            math.id,
                            `<div class="katex-display-container" data-math="${escapedForAttr}"></div>`
                        );
                    } else {
                        processedText = processedText.replace(
                            math.id,
                            `<span class="katex-inline-container" data-math="${escapedForAttr}"></span>`
                        );
                    }
                });

                return processedText;
            }
        };
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

            /* استایل‌های فرمول‌های ریاضی */
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

            /* نمایش خطا برای فرمول‌های رندر نشده */
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
        // چندین تلاش برای رندر فرمول‌ها
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

                // رندر فرمول‌های display
                const displayContainers = container.querySelectorAll('.katex-display-container:not(.rendered)');
                console.log(`Found ${displayContainers.length} display formula containers`);
                
                for (const displayContainer of displayContainers) {
                    const mathText = displayContainer.getAttribute('data-math') || displayContainer.textContent.trim();
                    if (!mathText) continue;

                    console.log('Rendering display formula:', mathText);
                    
                    try {
                        displayContainer.innerHTML = '';
                        katex.render(mathText, displayContainer, {
                            ...katexOptions,
                            displayMode: true
                        });
                        displayContainer.classList.add('rendered');
                        displayContainer.classList.add('katex-display');
                        console.log('Successfully rendered display formula');
                    } catch (error) {
                        console.error('خطا در رندر فرمول display:', error.message, 'Formula:', mathText);
                        displayContainer.innerHTML = `<div style="color: #ff6b6b; font-size: 12px; padding: 8px;">
                            خطا در رندر فرمول: <code style="display: block; margin-top: 4px; direction: ltr;">${this.escapeHtml(mathText)}</code>
                            <br><small>${error.message}</small>
                        </div>`;
                    }
                }

                // رندر فرمول‌های inline
                const inlineContainers = container.querySelectorAll('.katex-inline-container:not(.rendered)');
                console.log(`Found ${inlineContainers.length} inline formula containers`);
                
                for (const inlineContainer of inlineContainers) {
                    const mathText = inlineContainer.getAttribute('data-math') || inlineContainer.textContent.trim();
                    if (!mathText) continue;

                    console.log('Rendering inline formula:', mathText);
                    
                    try {
                        inlineContainer.innerHTML = '';
                        katex.render(mathText, inlineContainer, {
                            ...katexOptions,
                            displayMode: false
                        });
                        inlineContainer.classList.add('rendered');
                        inlineContainer.classList.add('katex-inline');
                        console.log('Successfully rendered inline formula');
                    } catch (error) {
                        console.error('خطا در رندر فرمول inline:', error.message, 'Formula:', mathText);
                        inlineContainer.innerHTML = `<code style="color: #ff6b6b; background: rgba(255, 107, 107, 0.1); padding: 4px 8px; border-radius: 4px; direction: ltr;">${this.escapeHtml(mathText)}<br><small>${error.message}</small></code>`;
                    }
                }

            } catch (error) {
                console.error('خطا در پردازش فرمول‌های ریاضی:', error);
            }
        };

        // شروع رندر با تأخیر کوتاه
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