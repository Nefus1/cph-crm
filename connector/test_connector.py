import json
import tempfile
import unittest
import uuid
from pathlib import Path
from connector import create_case, safe_path, SetupError, MARKER

class FolderTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.payload = {'root': str(self.root), 'matterId': str(uuid.uuid4()), 'relativePath': 'CPH-26-001 — Muñoz García, José', 'templateVersion': 'cph-1', 'folders': ['UD/Complaint/Filed', 'Scans'], 'files': {'Notes.txt': 'Initial notes'}}

    def test_retry_after_lost_ack_preserves_edits(self):
        folder = create_case(self.root, self.payload)
        (folder / 'Notes.txt').write_text('Staff edits')
        create_case(self.root, self.payload)
        self.assertEqual((folder / 'Notes.txt').read_text(), 'Staff edits')
        self.assertTrue((folder / 'UD/Complaint/Filed').is_dir())

    def test_unknown_and_different_identity_not_adopted(self):
        folder = self.root / self.payload['relativePath']
        folder.mkdir()
        with self.assertRaisesRegex(SetupError, 'folder_collision'):
            create_case(self.root, self.payload)
        (folder / MARKER).write_text(json.dumps({'matterId': str(uuid.uuid4()), 'templateVersion': 'cph-1'}))
        with self.assertRaisesRegex(SetupError, 'folder_collision'):
            create_case(self.root, self.payload)

    def test_partial_creation_recovers(self):
        folder = create_case(self.root, self.payload)
        (folder / 'Notes.txt').unlink()
        create_case(self.root, self.payload)
        self.assertEqual((folder / 'Notes.txt').read_text(), 'Initial notes')

    def test_traversal_and_windows_names(self):
        for path in ['../outside', '/absolute', 'C:/elsewhere', 'UD/../../x', 'UD\\file', 'CON', 'NUL.txt', 'x.', 'x ', 'x//y', 'a\x00b']:
            with self.subTest(path=path), self.assertRaises(SetupError):
                safe_path(self.root, path)

    def test_symlink_rejected(self):
        outside = self.root / 'outside'
        outside.mkdir()
        try:
            (self.root / 'link').symlink_to(outside, target_is_directory=True)
        except OSError:
            self.skipTest('Symlink permission unavailable')
        with self.assertRaises(SetupError):
            safe_path(self.root, 'link/file')

    def test_missing_root_not_created(self):
        with self.assertRaisesRegex(SetupError, 'root_unavailable'):
            create_case(self.root / 'missing', self.payload)
        self.assertFalse((self.root / 'missing').exists())

    def test_wrong_root_rejected(self):
        self.payload['root'] = 'D:\\Different'
        with self.assertRaisesRegex(SetupError, 'invalid_path'):
            create_case(self.root, self.payload)

if __name__ == '__main__':
    unittest.main()
