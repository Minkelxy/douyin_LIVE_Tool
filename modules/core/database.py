import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

class Database:
    def __init__(self):
        self.db_path = Path(__file__).parent.parent.parent / "data" / "danmu.db"
        self.db_path.parent.mkdir(exist_ok=True)
        self.init_database()

    def get_connection(self):
        return sqlite3.connect(str(self.db_path))

    def init_database(self):
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS danmu_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                danmu_id TEXT UNIQUE,
                user_id TEXT,
                nickname TEXT,
                content TEXT,
                timestamp TEXT,
                fan_level INTEGER DEFAULT 0,
                received_at TEXT,
                replied INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reply_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id TEXT UNIQUE,
                keyword TEXT NOT NULL,
                match_type TEXT DEFAULT 'contain',
                replies TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                priority INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reply_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                danmu_id TEXT,
                rule_id TEXT,
                reply_content TEXT,
                sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
                success INTEGER DEFAULT 1
            )
        ''')

        conn.commit()
        conn.close()

    def save_danmu(self, danmu: Dict) -> bool:
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO danmu_history
                (danmu_id, user_id, nickname, content, timestamp, fan_level, received_at, replied)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                danmu.get('id'),
                danmu.get('user_id'),
                danmu.get('nickname'),
                danmu.get('content'),
                danmu.get('timestamp'),
                danmu.get('fan_level', 0),
                danmu.get('received_at'),
                1 if danmu.get('replied') else 0
            ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"保存弹幕失败: {e}")
            return False

    def get_danmu_history(self, limit: int = 100) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT danmu_id, user_id, nickname, content, timestamp, replied
            FROM danmu_history
            ORDER BY received_at DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                'id': row[0],
                'user_id': row[1],
                'nickname': row[2],
                'content': row[3],
                'timestamp': row[4],
                'replied': bool(row[5])
            }
            for row in rows
        ]

    def save_reply_rule(self, rule: Dict) -> bool:
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT OR REPLACE INTO reply_rules
                (rule_id, keyword, match_type, replies, enabled, priority)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                rule.get('id'),
                rule.get('keyword'),
                rule.get('match_type', 'contain'),
                json.dumps(rule.get('replies', []), ensure_ascii=False),
                1 if rule.get('enabled', True) else 0,
                rule.get('priority', 0)
            ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"保存回复规则失败: {e}")
            return False

    def get_reply_rules(self) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT rule_id, keyword, match_type, replies, enabled, priority
            FROM reply_rules
            ORDER BY priority DESC, created_at ASC
        ''')
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                'id': row[0],
                'keyword': row[1],
                'match_type': row[2],
                'replies': json.loads(row[3]),
                'enabled': bool(row[4]),
                'priority': row[5]
            }
            for row in rows
        ]

    def delete_reply_rule(self, rule_id: str) -> bool:
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM reply_rules WHERE rule_id = ?', (rule_id,))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"删除规则失败: {e}")
            return False

    def save_reply_history(self, danmu_id: str, rule_id: str, reply_content: str, success: bool = True) -> bool:
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO reply_history (danmu_id, rule_id, reply_content, success)
                VALUES (?, ?, ?, ?)
            ''', (danmu_id, rule_id, reply_content, 1 if success else 0))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"保存回复历史失败: {e}")
            return False

    def get_reply_history(self, limit: int = 50) -> List[Dict]:
        conn = self.get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT danmu_id, rule_id, reply_content, sent_at, success
            FROM reply_history
            ORDER BY sent_at DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [
            {
                'danmu_id': row[0],
                'rule_id': row[1],
                'reply_content': row[2],
                'sent_at': row[3],
                'success': bool(row[4])
            }
            for row in rows
        ]

    def clear_danmu_history(self) -> bool:
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute('DELETE FROM danmu_history')
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"清空弹幕历史失败: {e}")
            return False

    def get_statistics(self) -> Dict:
        conn = self.get_connection()
        cursor = conn.cursor()

        cursor.execute('SELECT COUNT(*) FROM danmu_history')
        total_danmu = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM danmu_history WHERE replied = 1')
        replied_danmu = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM reply_rules WHERE enabled = 1')
        active_rules = cursor.fetchone()[0]

        cursor.execute('SELECT COUNT(*) FROM reply_history')
        total_replies = cursor.fetchone()[0]

        conn.close()
        return {
            'total_danmu': total_danmu,
            'replied_danmu': replied_danmu,
            'active_rules': active_rules,
            'total_replies': total_replies
        }
