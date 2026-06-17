class HandwritingRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = {
            text: '',
            fontFamily: '"KaiTi", "STKaiti", "楷体", serif',
            fontSize: 32,
            charSpacing: 2,
            lineHeight: 1.8,
            slantAngle: 0,
            inkDensity: 80,
            randomOffset: 3,
            strokeNoise: 30,
            pageWidth: 800,
            pageHeight: 1150,
            padding: 60,
            paperColor: '#faf8f0',
            inkColor: '#2c2c2c',
            weight: 'normal'
        };
        this.pages = [];
        this.currentPage = 0;
        this.seed = Math.random();
        this._textLinesCache = null;
        this._cacheKey = '';
        this._paperPatternCache = null;
        this._paperPatternKey = '';
    }

    setOptions(options) {
        Object.assign(this.options, options);
        this.seed = Math.random();
        this._textLinesCache = null;
        this._cacheKey = '';
    }

    seededRandom(seed) {
        const x = Math.sin(seed * 9999) * 10000;
        return x - Math.floor(x);
    }

    randomOffsetForChar(charIndex, lineIndex) {
        const seed = this.seed + charIndex * 1000 + lineIndex * 10000;
        const offsetX = (this.seededRandom(seed) - 0.5) * 2 * this.options.randomOffset;
        const offsetY = (this.seededRandom(seed + 100) - 0.5) * 2 * this.options.randomOffset;
        return { x: offsetX, y: offsetY };
    }

    randomRotationForChar(charIndex, lineIndex) {
        const seed = this.seed + charIndex * 2000 + lineIndex * 20000;
        return (this.seededRandom(seed) - 0.5) * 2.5;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    drawChar(ctx, char, x, y, charIndex, lineIndex) {
        const offset = this.randomOffsetForChar(charIndex, lineIndex);
        const rotation = this.randomRotationForChar(charIndex, lineIndex);
        const slantRad = (this.options.slantAngle + rotation) * Math.PI / 180;
        
        const inkRgb = this.hexToRgb(this.options.inkColor);
        const baseAlpha = 0.45 + (this.options.inkDensity / 100) * 0.55;
        const noiseLevel = this.options.strokeNoise / 100;
        
        ctx.save();
        ctx.translate(x + offset.x, y + offset.y);
        ctx.transform(1, 0, Math.tan(slantRad), 1, 0, 0);
        
        ctx.font = `${this.options.weight} ${this.options.fontSize}px ${this.options.fontFamily}`;
        ctx.textBaseline = 'top';
        
        const baseX = 0;
        const baseY = 0;
        
        ctx.globalCompositeOperation = 'source-over';
        
        for (let layer = 0; layer < 3; layer++) {
            const layerSeed = this.seed + charIndex * 100 + layer * 50 + lineIndex * 500;
            const layerAlpha = baseAlpha * (0.55 + layer * 0.25);
            const layerOffsetX = (this.seededRandom(layerSeed) - 0.5) * noiseLevel * 2.5;
            const layerOffsetY = (this.seededRandom(layerSeed + 1) - 0.5) * noiseLevel * 2.5;
            const scaleX = 1 + (this.seededRandom(layerSeed + 2) - 0.5) * 0.03;
            const scaleY = 1 + (this.seededRandom(layerSeed + 3) - 0.5) * 0.03;
            
            ctx.save();
            ctx.translate(layerOffsetX, layerOffsetY);
            ctx.scale(scaleX, scaleY);
            
            ctx.fillStyle = `rgba(${inkRgb.r}, ${inkRgb.g}, ${inkRgb.b}, ${layerAlpha})`;
            ctx.fillText(char, baseX, baseY);
            
            ctx.restore();
        }
        
        if (noiseLevel > 0.15) {
            this.addInkSplatter(ctx, char, charIndex, lineIndex, noiseLevel, inkRgb);
        }
        
        if (noiseLevel > 0.25) {
            this.addStrokeTexture(ctx, char, charIndex, lineIndex, noiseLevel, inkRgb, baseAlpha);
        }
        
        ctx.restore();
    }

    addInkSplatter(ctx, char, charIndex, lineIndex, noiseLevel, inkRgb) {
        const metrics = ctx.measureText(char);
        const width = metrics.width;
        const height = this.options.fontSize;
        
        const dotCount = Math.floor(noiseLevel * 25);
        
        for (let i = 0; i < dotCount; i++) {
            const seed = this.seed + charIndex * 1000 + lineIndex * 5000 + i * 17;
            const dx = this.seededRandom(seed) * (width + height * 0.4) - height * 0.2;
            const dy = this.seededRandom(seed + 1) * (height + height * 0.4) - height * 0.2;
            const size = this.seededRandom(seed + 2) * 1.8 + 0.3;
            const alpha = this.seededRandom(seed + 3) * noiseLevel * 0.35;
            
            ctx.fillStyle = `rgba(${inkRgb.r}, ${inkRgb.g}, ${inkRgb.b}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(dx, dy, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    addStrokeTexture(ctx, char, charIndex, lineIndex, noiseLevel, inkRgb, baseAlpha) {
        const fontSize = this.options.fontSize;
        
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        
        const holeCount = Math.floor(noiseLevel * 40);
        for (let i = 0; i < holeCount; i++) {
            const seed = this.seed + charIndex * 2000 + lineIndex * 8000 + i * 23;
            const dx = this.seededRandom(seed) * fontSize * 1.5;
            const dy = this.seededRandom(seed + 1) * fontSize * 1.2;
            const size = this.seededRandom(seed + 2) * 1.2 + 0.3;
            
            ctx.fillStyle = `rgba(0, 0, 0, ${this.seededRandom(seed + 3) * 0.15 + 0.05})`;
            ctx.beginPath();
            ctx.arc(dx, dy, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    addPaperTexture(ctx, width, height) {
        const paperColor = this.options.paperColor;
        const patternKey = `${paperColor}_${this.seed}`;
        
        if (this._paperPatternCache && this._paperPatternKey === patternKey) {
            ctx.fillStyle = this._paperPatternCache;
            ctx.fillRect(0, 0, width, height);
            return;
        }
        
        const paperRgb = this.hexToRgb(paperColor);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 256;
        tempCanvas.height = 256;
        const tempCtx = tempCanvas.getContext('2d');
        
        const imageData = tempCtx.createImageData(256, 256);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const idx = i / 4;
            const x = idx % 256;
            const y = Math.floor(idx / 256);
            const seed = this.seed + x * 0.1 + y * 0.1;
            const noise = (this.seededRandom(seed) - 0.5) * 14;
            
            data[i] = Math.max(0, Math.min(255, paperRgb.r + noise));
            data[i + 1] = Math.max(0, Math.min(255, paperRgb.g + noise));
            data[i + 2] = Math.max(0, Math.min(255, paperRgb.b + noise));
            data[i + 3] = 255;
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        
        const pattern = ctx.createPattern(tempCanvas, 'repeat');
        this._paperPatternCache = pattern;
        this._paperPatternKey = patternKey;
        
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width, height);
    }

    addPaperFiberEffect(ctx, width, height) {
        const fiberCount = Math.floor(width * height / 15000);
        const paperRgb = this.hexToRgb(this.options.paperColor);
        
        ctx.save();
        
        for (let i = 0; i < fiberCount; i++) {
            const seed = this.seed + i * 137;
            const x = this.seededRandom(seed) * width;
            const y = this.seededRandom(seed + 1) * height;
            const length = this.seededRandom(seed + 2) * 25 + 8;
            const angle = this.seededRandom(seed + 3) * Math.PI * 2;
            const alpha = this.seededRandom(seed + 4) * 0.12 + 0.03;
            const thickness = this.seededRandom(seed + 5) * 0.8 + 0.3;
            
            const endX = x + Math.cos(angle) * length;
            const endY = y + Math.sin(angle) * length;
            
            const darker = this.seededRandom(seed + 6) > 0.5;
            const color = darker ? 
                `rgba(${Math.max(0, paperRgb.r - 30)}, ${Math.max(0, paperRgb.g - 30)}, ${Math.max(0, paperRgb.b - 20)}, ${alpha})` :
                `rgba(${Math.min(255, paperRgb.r + 20)}, ${Math.min(255, paperRgb.g + 20)}, ${Math.min(255, paperRgb.b + 15)}, ${alpha})`;
            
            ctx.strokeStyle = color;
            ctx.lineWidth = thickness;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    splitTextIntoLines(text, maxWidth, ctx) {
        const cacheKey = `${text}_${maxWidth}_${this.options.fontFamily}_${this.options.fontSize}_${this.options.charSpacing}_${this.options.weight}`;
        
        if (this._textLinesCache && this._cacheKey === cacheKey) {
            return this._textLinesCache;
        }
        
        const paragraphs = text.split('\n');
        const lines = [];
        
        ctx.font = `${this.options.weight} ${this.options.fontSize}px ${this.options.fontFamily}`;
        
        for (const paragraph of paragraphs) {
            if (paragraph === '') {
                lines.push('');
                continue;
            }
            
            let currentLine = '';
            let currentWidth = 0;
            
            for (let i = 0; i < paragraph.length; i++) {
                const char = paragraph[i];
                const charWidth = ctx.measureText(char).width + this.options.charSpacing;
                
                if (currentWidth + charWidth > maxWidth && currentLine !== '') {
                    lines.push(currentLine);
                    currentLine = char;
                    currentWidth = charWidth;
                } else {
                    currentLine += char;
                    currentWidth += charWidth;
                }
            }
            
            if (currentLine !== '') {
                lines.push(currentLine);
            }
        }
        
        this._textLinesCache = lines;
        this._cacheKey = cacheKey;
        
        return lines;
    }

    calculatePages() {
        const { pageWidth, pageHeight, padding, lineHeight, fontSize } = this.options;
        const contentWidth = pageWidth - padding * 2;
        const contentHeight = pageHeight - padding * 2;
        const lineHeightPx = fontSize * lineHeight;
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        const lines = this.splitTextIntoLines(this.options.text, contentWidth, tempCtx);
        const linesPerPage = Math.floor(contentHeight / lineHeightPx);
        
        const pages = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }
        
        if (pages.length === 0) {
            pages.push([]);
        }
        
        return pages;
    }

    renderPage(pageIndex) {
        const { pageWidth, pageHeight, padding, fontSize, lineHeight, charSpacing, paperColor } = this.options;
        
        this.canvas.width = pageWidth;
        this.canvas.height = pageHeight;
        
        const ctx = this.ctx;
        
        this.addPaperTexture(ctx, pageWidth, pageHeight);
        this.addPaperFiberEffect(ctx, pageWidth, pageHeight);
        
        const pages = this.calculatePages();
        this.pages = pages;
        
        if (pageIndex >= pages.length) {
            pageIndex = pages.length - 1;
        }
        this.currentPage = pageIndex;
        
        const pageLines = pages[pageIndex];
        const lineHeightPx = fontSize * lineHeight;
        const startY = padding;
        
        let charIndexOffset = 0;
        for (let i = 0; i < pageIndex; i++) {
            charIndexOffset += pages[i].reduce((sum, line) => sum + line.length, 0);
        }
        
        let charCount = 0;
        ctx.font = `${this.options.weight} ${fontSize}px ${this.options.fontFamily}`;
        
        for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
            const line = pageLines[lineIndex];
            const y = startY + lineIndex * lineHeightPx;
            let x = padding;
            
            for (let charIndex = 0; charIndex < line.length; charIndex++) {
                const char = line[charIndex];
                const globalCharIndex = charIndexOffset + charCount;
                
                this.drawChar(ctx, char, x, y, globalCharIndex, lineIndex);
                
                const charWidth = ctx.measureText(char).width + charSpacing;
                x += charWidth;
                charCount++;
            }
        }
        
        return pages.length;
    }

    generateAllPages() {
        const pages = this.calculatePages();
        const canvases = [];
        
        const originalCanvas = this.canvas;
        const originalCtx = this.ctx;
        
        for (let i = 0; i < pages.length; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = this.options.pageWidth;
            canvas.height = this.options.pageHeight;
            
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            
            this.renderPage(i);
            
            canvases.push(canvas);
        }
        
        this.canvas = originalCanvas;
        this.ctx = originalCtx;
        
        return canvases;
    }

    exportPageAsPNG(pageIndex = this.currentPage) {
        this.renderPage(pageIndex);
        return this.canvas.toDataURL('image/png');
    }

    exportAllPagesAsPNG() {
        const canvases = this.generateAllPages();
        return canvases.map(canvas => canvas.toDataURL('image/png'));
    }

    exportLongImage() {
        const canvases = this.generateAllPages();
        const width = this.options.pageWidth;
        const totalHeight = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
        
        const longCanvas = document.createElement('canvas');
        longCanvas.width = width;
        longCanvas.height = totalHeight;
        
        const ctx = longCanvas.getContext('2d');
        
        let y = 0;
        for (const canvas of canvases) {
            ctx.drawImage(canvas, 0, y);
            y += canvas.height;
        }
        
        return longCanvas.toDataURL('image/png');
    }

    getPageCount() {
        return this.calculatePages().length;
    }
}
