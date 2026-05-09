import json
import os
from pathlib import Path

class Config:
    def __init__(self):
        self.config_dir = Path(__file__).parent.parent.parent / "config"
        self.config_dir.mkdir(exist_ok=True)
        self.config_file = self.config_dir / "settings.json"
        self.default_settings = {
            "theme": "dark",
            "auto_scroll": True,
            "max_danmu_display": 500,
            "reply_interval": 3,
            "enable_auto_reply": True,
            "window_size": [1000, 700],
            "log_level": "INFO"
        }
        self.settings = self.load_settings()

    def load_settings(self):
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    return {**self.default_settings, **json.load(f)}
            except:
                return self.default_settings.copy()
        return self.default_settings.copy()

    def save_settings(self):
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.settings, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"保存配置失败: {e}")
            return False

    def get(self, key, default=None):
        return self.settings.get(key, default)

    def set(self, key, value):
        self.settings[key] = value
        return self.save_settings()
