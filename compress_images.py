import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Ошибка: Библиотека Pillow не установлена. Запустите: pip install Pillow")
    sys.exit(1)

IMAGE_DIR = 'images'
MAX_SIZE = 1000  # Максимальная ширина или высота (для карточек этого более чем достаточно)

def compress_images():
    count = 0
    saved_bytes = 0
    
    for filename in os.listdir(IMAGE_DIR):
        if not filename.lower().endswith(('.jpg', '.jpeg', '.png')):
            continue
            
        filepath = os.path.join(IMAGE_DIR, filename)
        original_size = os.path.getsize(filepath)
        
        # Пропускаем файлы меньше 300 КБ (они и так лёгкие)
        if original_size < 300 * 1024:
            continue
            
        try:
            with Image.open(filepath) as img:
                # Конвертируем в RGB, чтобы избежать проблем с прозрачностью при сохранении
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                
                # Уменьшаем размер пропорционально, если картинка больше MAX_SIZE
                img.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)
                
                # Сохраняем поверх с оптимизацией
                img.save(filepath, optimize=True, quality=80)
                
            new_size = os.path.getsize(filepath)
            if new_size < original_size:
                saved = original_size - new_size
                saved_bytes += saved
                count += 1
                print(f"Сжато: {filename} ({original_size // 1024} KB -> {new_size // 1024} KB)")
        except Exception as e:
            print(f"Ошибка при обработке {filename}: {e}")
            
    print(f"\nГотово! Успешно сжато картинок: {count}.")
    print(f"Сэкономлено места: {saved_bytes // (1024*1024)} МБ.")

if __name__ == "__main__":
    print("Начинаю сжатие изображений...")
    compress_images()
