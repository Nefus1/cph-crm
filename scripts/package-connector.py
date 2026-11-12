"""Build a credential-free distribution with an explicit allow-list."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
output = root / 'dist' / 'CPH-Windows-Connector.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as package:
    for name in ['connector.py', 'config.example.json', 'requirements.txt', 'install.ps1', 'README.md', 'test_connector.py']:
        package.write(root / 'connector' / name, 'CPH-Windows-Connector/' + name)
print(output)
