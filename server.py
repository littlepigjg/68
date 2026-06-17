from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import io
import random
import math
import base64
import json

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'output'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['OUTPUT_FOLDER'] = OUTPUT_FOLDER


def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def add_noise_to_image(image, noise_level=10):
    pixels = image.load()
    width, height = image.size
    
    for i in range(0, width, 2):
        for j in range(0, height, 2):
            if random.random() < noise_level / 100:
                r, g, b, a = pixels[i, j]
                noise = random.randint(-15, 15)
                pixels[i, j] = (
                    max(0, min(255, r + noise)),
                    max(0, min(255, g + noise)),
                    max(0, min(255, b + noise)),
                    a
                )
    return image


def add_ink_noise(draw, char, x, y, font, ink_color, noise_level):
    bbox = draw.textbbox((x, y), char, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    
    dot_count = int(noise_level * 15)
    for _ in range(dot_count):
        dx = x + random.uniform(-width * 0.1, width * 1.1)
        dy = y + random.uniform(-height * 0.1, height * 1.1)
        size = random.uniform(0.5, 2)
        alpha = int(random.uniform(10, 80) * noise_level / 100)
        
        r, g, b = ink_color[:3]
        draw.ellipse(
            [dx - size, dy - size, dx + size, dy + size],
            fill=(r, g, b, alpha)
        )


def render_text_to_image(text, options):
    page_width = options.get('pageWidth', 800)
    page_height = options.get('pageHeight', 1132)
    padding = options.get('padding', 60)
    font_size = options.get('fontSize', 32)
    char_spacing = options.get('charSpacing', 2)
    line_height_ratio = options.get('lineHeight', 1.8)
    slant_angle = options.get('slantAngle', 0)
    ink_density = options.get('inkDensity', 80)
    random_offset = options.get('randomOffset', 3)
    stroke_noise = options.get('strokeNoise', 30)
    paper_color = options.get('paperColor', '#faf8f0')
    ink_color = options.get('inkColor', '#2c2c2c')
    font_path = options.get('fontPath', None)
    weight = options.get('weight', 'normal')
    
    paper_rgb = hex_to_rgb(paper_color)
    ink_rgb = hex_to_rgb(ink_color)
    
    content_width = page_width - padding * 2
    content_height = page_height - padding * 2
    line_height = int(font_size * line_height_ratio)
    
    if font_path and os.path.exists(font_path):
        try:
            font = ImageFont.truetype(font_path, font_size)
        except:
            font = ImageFont.load_default()
    else:
        font = ImageFont.load_default()
    
    paragraphs = text.split('\n')
    lines = []
    
    for paragraph in paragraphs:
        if not paragraph:
            lines.append('')
            continue
        
        current_line = ''
        for char in paragraph:
            test_line = current_line + char
            bbox = font.getbbox(test_line)
            text_width = bbox[2] - bbox[0] + char_spacing * len(test_line)
            
            if text_width > content_width and current_line:
                lines.append(current_line)
                current_line = char
            else:
                current_line = test_line
        
        if current_line:
            lines.append(current_line)
    
    lines_per_page = max(1, content_height // line_height)
    pages = [lines[i:i + lines_per_page] for i in range(0, len(lines), lines_per_page)]
    
    if not pages:
        pages = [[]]
    
    result_pages = []
    
    for page_lines in pages:
        img = Image.new('RGBA', (page_width, page_height), (*paper_rgb, 255))
        
        pixels = img.load()
        for i in range(page_width):
            for j in range(page_height):
                if random.random() < 0.05:
                    noise = random.randint(-8, 8)
                    r, g, b, a = pixels[i, j]
                    pixels[i, j] = (
                        max(0, min(255, r + noise)),
                        max(0, min(255, g + noise)),
                        max(0, min(255, b + noise)),
                        a
                    )
        
        draw = ImageDraw.Draw(img)
        
        y = padding
        char_index = 0
        
        for line_idx, line in enumerate(page_lines):
            x = padding
            
            for char_idx, char in enumerate(line):
                offset_x = random.uniform(-random_offset, random_offset)
                offset_y = random.uniform(-random_offset, random_offset)
                rotation = random.uniform(-1.5, 1.5)
                
                char_x = x + offset_x
                char_y = y + offset_y
                
                if slant_angle != 0 or rotation != 0:
                    char_img = Image.new('RGBA', (font_size * 2, font_size * 2), (0, 0, 0, 0))
                    char_draw = ImageDraw.Draw(char_img)
                    
                    alpha = int(255 * (0.5 + (ink_density / 100) * 0.5))
                    r, g, b = ink_rgb
                    
                    for layer in range(3):
                        layer_alpha = int(alpha * (0.6 + layer * 0.2))
                        layer_offset_x = random.uniform(-stroke_noise * 0.1, stroke_noise * 0.1)
                        layer_offset_y = random.uniform(-stroke_noise * 0.1, stroke_noise * 0.1)
                        
                        char_draw.text(
                            (font_size // 2 + layer_offset_x, font_size // 4 + layer_offset_y),
                            char,
                            font=font,
                            fill=(r, g, b, layer_alpha)
                        )
                    
                    total_angle = slant_angle + rotation
                    slant_rad = math.radians(total_angle)
                    
                    char_img = char_img.transform(
                        (font_size * 2, font_size * 2),
                        Image.AFFINE,
                        (1, 0, 0, math.tan(slant_rad), 1, 0),
                        Image.BICUBIC
                    )
                    
                    bbox = font.getbbox(char)
                    char_width = bbox[2] - bbox[0]
                    
                    img.paste(
                        char_img,
                        (int(char_x - font_size // 2), int(char_y - font_size // 4)),
                        char_img
                    )
                    
                    if stroke_noise > 20:
                        add_ink_noise(draw, char, char_x, char_y, font, ink_rgb, stroke_noise / 100)
                    
                    x += char_width + char_spacing
                else:
                    alpha = int(255 * (0.5 + (ink_density / 100) * 0.5))
                    r, g, b = ink_rgb
                    
                    for layer in range(3):
                        layer_alpha = int(alpha * (0.6 + layer * 0.2))
                        layer_offset_x = random.uniform(-stroke_noise * 0.05, stroke_noise * 0.05)
                        layer_offset_y = random.uniform(-stroke_noise * 0.05, stroke_noise * 0.05)
                        
                        draw.text(
                            (char_x + layer_offset_x, char_y + layer_offset_y),
                            char,
                            font=font,
                            fill=(r, g, b, layer_alpha)
                        )
                    
                    if stroke_noise > 20:
                        add_ink_noise(draw, char, char_x, char_y, font, ink_rgb, stroke_noise / 100)
                    
                    bbox = font.getbbox(char)
                    char_width = bbox[2] - bbox[0]
                    x += char_width + char_spacing
                
                char_index += 1
            
            y += line_height
        
        result_pages.append(img)
    
    return result_pages


@app.route('/')
def index():
    return send_from_directory('.', 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)


@app.route('/api/generate', methods=['POST'])
def generate():
    try:
        data = request.json
        text = data.get('text', '')
        options = data.get('options', {})
        
        pages = render_text_to_image(text, options)
        
        result = []
        for i, page_img in enumerate(pages):
            buffer = io.BytesIO()
            page_img.save(buffer, format='PNG')
            buffer.seek(0)
            img_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            result.append({
                'page': i + 1,
                'image': f'data:image/png;base64,{img_base64}'
            })
        
        return jsonify({
            'success': True,
            'pageCount': len(pages),
            'pages': result
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/upload-font', methods=['POST'])
def upload_font():
    try:
        if 'font' not in request.files:
            return jsonify({'success': False, 'error': 'No font file provided'}), 400
        
        font_file = request.files['font']
        if font_file.filename == '':
            return jsonify({'success': False, 'error': 'No font file selected'}), 400
        
        if not font_file.filename.lower().endswith(('.ttf', '.otf')):
            return jsonify({'success': False, 'error': 'Only TTF and OTF files are supported'}), 400
        
        filename = f"font_{random.randint(1000, 9999)}_{font_file.filename}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        font_file.save(filepath)
        
        return jsonify({
            'success': True,
            'fontPath': filepath,
            'fontName': font_file.filename
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/export-long-image', methods=['POST'])
def export_long_image():
    try:
        data = request.json
        text = data.get('text', '')
        options = data.get('options', {})
        
        pages = render_text_to_image(text, options)
        
        total_height = sum(img.height for img in pages)
        width = pages[0].width if pages else 800
        
        long_img = Image.new('RGBA', (width, total_height), (255, 255, 255, 255))
        
        y_offset = 0
        for page_img in pages:
            long_img.paste(page_img, (0, y_offset))
            y_offset += page_img.height
        
        buffer = io.BytesIO()
        long_img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name='handwriting_long.png'
        )
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/export-pages', methods=['POST'])
def export_pages():
    try:
        data = request.json
        text = data.get('text', '')
        options = data.get('options', {})
        page_index = data.get('page', 0)
        
        pages = render_text_to_image(text, options)
        
        if page_index < 0 or page_index >= len(pages):
            page_index = 0
        
        buffer = io.BytesIO()
        pages[page_index].save(buffer, format='PNG')
        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name=f'handwriting_page_{page_index + 1}.png'
        )
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')
