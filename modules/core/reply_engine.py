import re
import time
from typing import List, Dict, Optional, Callable
from datetime import datetime

class ReplyEngine:
    def __init__(self, database):
        self.database = database
        self.rules = []
        self.enabled = True
        self.reply_callback = None
        self.cooldown_dict = {}
        self.cooldown_period = 60
        self.last_reply_time = {}

    def load_rules(self):
        self.rules = self.database.get_reply_rules()

    def set_reply_callback(self, callback: Callable):
        self.reply_callback = callback

    def enable(self):
        self.enabled = True

    def disable(self):
        self.enabled = False

    def is_enabled(self) -> bool:
        return self.enabled

    def add_rule(self, keyword: str, replies: List[str], match_type: str = 'contain', priority: int = 0) -> bool:
        import uuid
        rule = {
            'id': str(uuid.uuid4())[:8],
            'keyword': keyword,
            'match_type': match_type,
            'replies': replies if isinstance(replies, list) else [replies],
            'enabled': True,
            'priority': priority
        }

        if self.database.save_reply_rule(rule):
            self.rules.append(rule)
            return True
        return False

    def update_rule(self, rule_id: str, keyword: str = None, replies: List[str] = None,
                   match_type: str = None, enabled: bool = None) -> bool:
        for rule in self.rules:
            if rule['id'] == rule_id:
                if keyword is not None:
                    rule['keyword'] = keyword
                if replies is not None:
                    rule['replies'] = replies
                if match_type is not None:
                    rule['match_type'] = match_type
                if enabled is not None:
                    rule['enabled'] = enabled

                return self.database.save_reply_rule(rule)

        return False

    def delete_rule(self, rule_id: str) -> bool:
        if self.database.delete_reply_rule(rule_id):
            self.rules = [r for r in self.rules if r['id'] != rule_id]
            return True
        return False

    def toggle_rule(self, rule_id: str) -> bool:
        for rule in self.rules:
            if rule['id'] == rule_id:
                rule['enabled'] = not rule['enabled']
                return self.database.save_reply_rule(rule)
        return False

    def get_rules(self) -> List[Dict]:
        return self.rules.copy()

    def match_rule(self, content: str) -> Optional[Dict]:
        if not self.enabled:
            return None

        content_lower = content.lower()

        sorted_rules = sorted(self.rules, key=lambda x: x.get('priority', 0), reverse=True)

        for rule in sorted_rules:
            if not rule.get('enabled', True):
                continue

            keyword = rule['keyword'].lower()
            match_type = rule.get('match_type', 'contain')

            matched = False

            if match_type == 'exact':
                matched = content_lower == keyword
            elif match_type == 'contain':
                matched = keyword in content_lower
            elif match_type == 'regex':
                try:
                    matched = bool(re.search(keyword, content, re.IGNORECASE))
                except re.error:
                    matched = False

            if matched:
                return rule

        return None

    def process_danmu(self, danmu: Dict) -> Optional[str]:
        content = danmu.get('content', '')

        if not content or danmu.get('is_join'):
            return None

        matched_rule = self.match_rule(content)

        if matched_rule:
            reply = self.select_reply(matched_rule)

            if reply:
                danmu_id = danmu.get('id', '')
                rule_id = matched_rule['id']

                self.database.save_reply_history(danmu_id, rule_id, reply, True)

                if self.reply_callback:
                    self.reply_callback(reply, danmu)

                return reply

        return None

    def select_reply(self, rule: Dict) -> Optional[str]:
        replies = rule.get('replies', [])

        if not replies:
            return None

        import random
        reply = random.choice(replies)

        return reply

    def should_rate_limit(self, user_id: str) -> bool:
        current_time = time.time()

        if user_id in self.last_reply_time:
            last_time = self.last_reply_time[user_id]
            if current_time - last_time < 5:
                return True

        self.last_reply_time[user_id] = current_time

        return False

    def get_statistics(self) -> Dict:
        stats = self.database.get_statistics()
        stats['enabled'] = self.enabled
        stats['total_rules'] = len(self.rules)
        stats['active_rules'] = len([r for r in self.rules if r.get('enabled', True)])

        return stats
