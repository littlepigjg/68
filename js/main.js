class HandwritingApp {
    constructor() {
        this.canvas = document.getElementById('previewCanvas');
        this.renderer = new HandwritingRenderer(this.canvas);
        this.currentStyle = 'kaishu';
        this.customFontFamily = null;
        this.debounceTimer = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.applyStyle('kaishu');
        this.generatePreview();
    }

    bindEvents() {
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const style = e.target.dataset.style;
                this.applyStyle(style);
                this.generatePreview();
            });
        });

        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderer.setOptions({ paperColor: e.target.dataset.color });
                this.generatePreview();
            });
        });

        document.querySelectorAll('.ink-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.ink-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderer.setOptions({ inkColor: e.target.dataset.color });
                this.generatePreview();
            });
        });

        const params = ['fontSize', 'charSpacing', 'lineHeight', 'slantAngle', 'inkDensity', 'randomOffset', 'strokeNoise', 'pageWidth', 'pageHeight', 'padding'];
        
        params.forEach(param => {
            const input = document.getElementById(param);
            const valueDisplay = document.getElementById(param + 'Value');
            
            if (input && valueDisplay) {
                input.addEventListener('input', (e) => {
                    this.updateParamDisplay(param, e.target.value);
                    this.updateRendererOption(param, e.target.value);
                    this.debouncedGenerate();
                });
            }
        });

        document.getElementById('textInput').addEventListener('input', () => {
            this.debouncedGenerate();
        });

        document.getElementById('generateBtn').addEventListener('click', () => {
            this.renderer.seed = Math.random();
            this.generatePreview();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportCurrentPage();
        });

        document.getElementById('exportAllBtn').addEventListener('click', () => {
            this.exportAllPages();
        });

        document.getElementById('exportLongBtn').addEventListener('click', () => {
            this.exportLongImage();
        });

        document.getElementById('prevPage').addEventListener('click', () => {
            this.changePage(-1);
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            this.changePage(1);
        });

        document.getElementById('fontFile').addEventListener('change', (e) => {
            this.handleFontUpload(e.target.files[0]);
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                this.renderer.seed = Math.random();
                this.generatePreview();
            }
        });
    }

    debouncedGenerate() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.generatePreview();
        }, 150);
    }

    updateParamDisplay(param, value) {
        const valueDisplay = document.getElementById(param + 'Value');
        if (!valueDisplay) return;
        
        switch (param) {
            case 'fontSize':
            case 'charSpacing':
            case 'randomOffset':
            case 'pageWidth':
            case 'pageHeight':
            case 'padding':
                valueDisplay.textContent = value + 'px';
                break;
            case 'lineHeight':
                valueDisplay.textContent = parseFloat(value).toFixed(1);
                break;
            case 'slantAngle':
                valueDisplay.textContent = value + '°';
                break;
            case 'inkDensity':
            case 'strokeNoise':
                valueDisplay.textContent = value + '%';
                break;
            default:
                valueDisplay.textContent = value;
        }
    }

    updateRendererOption(param, value) {
        const numValue = parseFloat(value);
        this.renderer.setOptions({ [param]: numValue });
    }

    applyStyle(styleName) {
        this.currentStyle = styleName;
        
        document.querySelectorAll('.style-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-style="${styleName}"]`).classList.add('active');
        
        const style = HandwritingStyles[styleName];
        if (!style) return;
        
        const options = { ...style };
        delete options.name;
        delete options.description;
        
        if (styleName === 'custom' && this.customFontFamily) {
            options.fontFamily = this.customFontFamily;
        }
        
        this.renderer.setOptions(options);
        
        this.updateUIFromOptions(options);
    }

    updateUIFromOptions(options) {
        const paramMap = {
            fontSize: 'fontSize',
            charSpacing: 'charSpacing',
            lineHeight: 'lineHeight',
            slantAngle: 'slantAngle',
            inkDensity: 'inkDensity',
            randomOffset: 'randomOffset',
            strokeNoise: 'strokeNoise'
        };
        
        for (const [optionKey, inputId] of Object.entries(paramMap)) {
            const input = document.getElementById(inputId);
            if (input && options[optionKey] !== undefined) {
                input.value = options[optionKey];
                this.updateParamDisplay(inputId, options[optionKey]);
            }
        }
    }

    handleFontUpload(file) {
        if (!file) return;
        
        if (!file.name.toLowerCase().endsWith('.ttf') && !file.name.toLowerCase().endsWith('.otf')) {
            alert('请上传TTF或OTF格式的字体文件');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const fontData = e.target.result;
            const fontName = 'CustomHandwritingFont';
            
            const fontFace = new FontFace(fontName, fontData);
            fontFace.load().then((loadedFace) => {
                document.fonts.add(loadedFace);
                
                this.customFontFamily = `'${fontName}', serif`;
                
                document.getElementById('fontName').textContent = `✓ ${file.name}`;
                
                this.applyStyle('custom');
                this.renderer.setOptions({ fontFamily: this.customFontFamily });
                this.generatePreview();
            }).catch((err) => {
                console.error('字体加载失败:', err);
                alert('字体加载失败，请检查文件格式');
            });
        };
        reader.readAsArrayBuffer(file);
    }

    generatePreview() {
        const text = document.getElementById('textInput').value;
        this.renderer.setOptions({ text });
        
        this.showLoading();
        
        requestAnimationFrame(() => {
            const startTime = performance.now();
            
            const pageCount = this.renderer.renderPage(this.renderer.currentPage);
            
            const endTime = performance.now();
            console.log(`生成耗时: ${(endTime - startTime).toFixed(2)}ms, 共 ${pageCount} 页`);
            
            this.updatePageInfo();
            this.hideLoading();
        });
    }

    changePage(direction) {
        const pageCount = this.renderer.getPageCount();
        let newPage = this.renderer.currentPage + direction;
        
        if (newPage < 0) newPage = 0;
        if (newPage >= pageCount) newPage = pageCount - 1;
        
        if (newPage !== this.renderer.currentPage) {
            this.renderer.renderPage(newPage);
            this.updatePageInfo();
        }
    }

    updatePageInfo() {
        const current = this.renderer.currentPage + 1;
        const total = this.renderer.getPageCount();
        document.getElementById('pageInfo').textContent = `第 ${current} 页 / 共 ${total} 页`;
        
        document.getElementById('prevPage').disabled = this.renderer.currentPage === 0;
        document.getElementById('nextPage').disabled = this.renderer.currentPage >= total - 1;
    }

    exportCurrentPage() {
        const dataUrl = this.renderer.exportPageAsPNG();
        this.downloadImage(dataUrl, `handwriting_page_${this.renderer.currentPage + 1}.png`);
    }

    exportAllPages() {
        const total = this.renderer.getPageCount();
        if (!confirm(`确定要导出 ${total} 页PNG图片吗？`)) return;
        
        const dataUrls = this.renderer.exportAllPagesAsPNG();
        
        dataUrls.forEach((dataUrl, index) => {
            setTimeout(() => {
                this.downloadImage(dataUrl, `handwriting_page_${index + 1}.png`);
            }, index * 300);
        });
    }

    exportLongImage() {
        const total = this.renderer.getPageCount();
        this.showLoading();
        
        setTimeout(() => {
            const dataUrl = this.renderer.exportLongImage();
            this.downloadImage(dataUrl, `handwriting_long_${total}页.png`);
            this.hideLoading();
        }, 50);
    }

    downloadImage(dataUrl, filename) {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    showLoading() {
        document.getElementById('loading').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            window.app = new HandwritingApp();
        });
    } else {
        window.app = new HandwritingApp();
    }
});
