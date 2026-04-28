with open(r'c:\Users\Administrator\OneDrive\Desktop\pro\src\pages\admin\Events.jsx', 'r', encoding='utf-8') as f:
    content = f.read()
    print(f"Open: {content.count('{')}")
    print(f"Close: {content.count('}')}")
