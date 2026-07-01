import json

with open('data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Fix brands array
data['brands'] = ['Conte', 'Milavitsa']

# Fix about text
if 'about_text_2' in data.get('brand', {}):
    data['brand']['about_text_2'] = data['brand']['about_text_2'].replace('Conti', 'Conte')

# Auto-fill brand based on product name
count = 0
for p in data['products']:
    name = p.get('name', '').strip()
    if name.lower().startswith('conte'):
        p['brand'] = 'Conte'
        count += 1
    elif name.lower().startswith('milavitsa'):
        p['brand'] = 'Milavitsa'
        count += 1
    elif not p.get('brand'):
        p['brand'] = ''

with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Gotovo! Obnovleno brendov: {count}')
print(f'brands massiv: {data["brands"]}')

# Show stats
brands_count = {}
for p in data['products']:
    b = p.get('brand', '') or '(pust)'
    brands_count[b] = brands_count.get(b, 0) + 1
for b, c in sorted(brands_count.items()):
    print(f'  {b}: {c} tovarov')
