import sys
from pathlib import Path
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
                             QLabel, QLineEdit, QPushButton, QTextEdit, QListWidget,
                             QListWidgetItem, QGroupBox, QScrollArea, QFrame, QMessageBox,
                             QDialog, QFormLayout, QComboBox, QCheckBox, QTabWidget,
                             QSplitter, QStatusBar, QMenuBar, QMenu)
from PyQt6.QtCore import Qt, QTimer, pyqtSignal, QThread, QSize
from PyQt6.QtGui import QFont, QColor, QPalette, QAction, QIcon, QPainter, QBrush, QPen
from modules.core.database import Database
from modules.core.config import Config
from modules.core.reply_engine import ReplyEngine
from modules.api.douyin_api import DouyinAPI

class AnimatedListWidget(QListWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setUniformItemSizes(True)

class DanmuItem(QFrame):
    def __init__(self, danmu_data, parent=None):
        super().__init__(parent)
        self.danmu_data = danmu_data
        self.setup_ui()

    def setup_ui(self):
        self.setFixedHeight(70)
        self.setStyleSheet("""
            QFrame {
                background-color: #16213E;
                border-left: 3px solid #25F4EE;
                border-radius: 6px;
                margin: 4px;
                padding: 8px;
            }
            QFrame:hover {
                background-color: #1A2847;
            }
        """)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(10, 5, 10, 5)
        layout.setSpacing(5)

        top_layout = QHBoxLayout()

        nickname_label = QLabel(f"@{self.danmu_data.get('nickname', '匿名用户')}")
        nickname_font = QFont()
        nickname_font.setPointSize(11)
        nickname_font.setBold(True)
        nickname_label.setFont(nickname_font)
        nickname_label.setStyleSheet("color: #25F4EE; background: transparent;")

        time_label = QLabel(self.danmu_data.get('received_at', ''))
        time_label.setStyleSheet("color: #888; background: transparent;")
        time_font = QFont()
        time_font.setPointSize(9)
        time_label.setFont(time_font)

        top_layout.addWidget(nickname_label)
        top_layout.addStretch()
        top_layout.addWidget(time_label)

        content_label = QLabel(self.danmu_data.get('content', ''))
        content_label.setWordWrap(True)
        content_font = QFont()
        content_font.setPointSize(12)
        content_label.setFont(content_font)
        content_label.setStyleSheet("color: #FFFFFF; background: transparent;")

        layout.addLayout(top_layout)
        layout.addWidget(content_label)

        if self.danmu_data.get('replied'):
            self.setStyleSheet("""
                QFrame {
                    background-color: #16213E;
                    border-left: 3px solid #00C853;
                    border-radius: 6px;
                    margin: 4px;
                    padding: 8px;
                }
            """)

class StatusIndicator(QFrame):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.status = False
        self.setFixedSize(12, 12)

    def set_status(self, connected):
        self.status = connected
        self.update()

    def paint(self, painter):
        painter.setRenderHint(QPainter.RenderHint.Antialiasing)

        color = QColor("#00C853") if self.status else QColor("#FF5252")
        brush = QBrush(color)
        painter.setBrush(brush)

        pen = QPen(Qt.PenStyle.NoPen)
        painter.setPen(pen)

        painter.drawEllipse(0, 0, 12, 12)

class MainWindow(QMainWindow):
    danmu_received = pyqtSignal(dict)
    status_changed = pyqtSignal(str, bool)

    def __init__(self):
        super().__init__()
        self.database = Database()
        self.config = Config()
        self.reply_engine = ReplyEngine(self.database)
        self.douyin_api = DouyinAPI()

        self.danmu_list = []
        self.max_danmu_display = 500

        self.init_ui()
        self.init_connections()

        self.douyin_api.set_on_danmu_callback(self.handle_new_danmu)
        self.douyin_api.set_on_status_callback(self.handle_status_change)

        self.reply_engine.set_reply_callback(self.handle_auto_reply)

        self.reply_engine.load_rules()
        self.update_rules_display()

    def init_ui(self):
        self.setWindowTitle("抖音弹幕助手 v1.0")
        self.setMinimumSize(1000, 700)

        self.apply_stylesheet()

        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(10, 10, 10, 10)
        main_layout.setSpacing(10)

        left_panel = self.create_left_panel()
        right_panel = self.create_right_panel()

        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.addWidget(left_panel)
        splitter.addWidget(right_panel)
        splitter.setSizes([300, 700])

        main_layout.addWidget(splitter)

        self.create_status_bar()

    def apply_stylesheet(self):
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1A1A2E;
            }
            QWidget {
                font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
                font-size: 14px;
                color: #FFFFFF;
            }
            QGroupBox {
                font-weight: bold;
                border: 1px solid #25F4EE;
                border-radius: 8px;
                margin-top: 12px;
                padding-top: 10px;
            }
            QGroupBox::title {
                color: #25F4EE;
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px;
            }
            QLineEdit {
                background-color: #0F3460;
                border: 1px solid #25F4EE;
                border-radius: 6px;
                padding: 10px;
                color: #FFFFFF;
                selection-background-color: #FE2C55;
            }
            QLineEdit:focus {
                border: 1px solid #4FD5D3;
            }
            QLineEdit:disabled {
                background-color: #0A1628;
                border: 1px solid #555;
                color: #888;
            }
            QPushButton {
                background-color: #FE2C55;
                border: none;
                border-radius: 6px;
                padding: 10px 20px;
                color: #FFFFFF;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #FF4080;
            }
            QPushButton:pressed {
                background-color: #E02440;
            }
            QPushButton:disabled {
                background-color: #555;
                color: #888;
            }
            QPushButton.secondary {
                background-color: transparent;
                border: 1px solid #25F4EE;
                color: #25F4EE;
            }
            QPushButton.secondary:hover {
                background-color: rgba(37, 244, 238, 0.1);
            }
            QPushButton.success {
                background-color: #00C853;
            }
            QPushButton.success:hover {
                background-color: #00E676;
            }
            QPushButton.danger {
                background-color: #FF5252;
            }
            QPushButton.danger:hover {
                background-color: #FF7070;
            }
            QListWidget {
                background-color: #0F3460;
                border: 1px solid #25F4EE;
                border-radius: 8px;
                padding: 5px;
                outline: none;
            }
            QListWidget::item {
                color: #FFFFFF;
                padding: 5px;
                border-radius: 4px;
            }
            QListWidget::item:selected {
                background-color: rgba(254, 44, 85, 0.3);
            }
            QScrollBar:vertical {
                background-color: #0F3460;
                width: 10px;
                border-radius: 5px;
            }
            QScrollBar::handle:vertical {
                background-color: #25F4EE;
                border-radius: 5px;
                min-height: 30px;
            }
            QScrollBar::handle:vertical:hover {
                background-color: #4FD5D3;
            }
            QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
                height: 0px;
            }
            QCheckBox {
                color: #FFFFFF;
                spacing: 8px;
            }
            QCheckBox::indicator {
                width: 18px;
                height: 18px;
                border: 2px solid #25F4EE;
                border-radius: 4px;
                background-color: transparent;
            }
            QCheckBox::indicator:checked {
                background-color: #25F4EE;
            }
            QComboBox {
                background-color: #0F3460;
                border: 1px solid #25F4EE;
                border-radius: 6px;
                padding: 8px;
                color: #FFFFFF;
            }
            QComboBox::drop-down {
                border: none;
            }
            QComboBox::down-arrow {
                image: none;
                border-left: 5px solid transparent;
                border-right: 5px solid transparent;
                border-top: 5px solid #25F4EE;
            }
            QTabWidget::pane {
                border: 1px solid #25F4EE;
                border-radius: 8px;
                background-color: #16213E;
            }
            QTabBar::tab {
                background-color: #0F3460;
                color: #B8B8B8;
                padding: 8px 20px;
                border-top-left-radius: 8px;
                border-top-right-radius: 8px;
            }
            QTabBar::tab:selected {
                background-color: #16213E;
                color: #FFFFFF;
            }
            QLabel {
                background: transparent;
            }
            QStatusBar {
                background-color: #0F3460;
                color: #B8B8B8;
            }
        """)

    def create_left_panel(self):
        left_widget = QWidget()
        left_widget.setFixedWidth(300)

        layout = QVBoxLayout(left_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(15)

        connection_group = self.create_connection_group()
        rules_group = self.create_rules_group()
        control_group = self.create_control_group()

        layout.addWidget(connection_group)
        layout.addWidget(rules_group)
        layout.addWidget(control_group)
        layout.addStretch()

        return left_widget

    def create_connection_group(self):
        group = QGroupBox("🔗 直播间连接")

        layout = QVBoxLayout()
        layout.setSpacing(12)

        room_layout = QFormLayout()
        self.room_id_input = QLineEdit()
        self.room_id_input.setPlaceholderText("输入直播间链接或房间号")
        room_layout.addRow("房间ID:", self.room_id_input)

        self.connect_btn = QPushButton("连接直播间")
        self.connect_btn.clicked.connect(self.toggle_connection)

        self.status_label = QLabel("状态: 未连接")
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.status_indicator = StatusIndicator()

        status_layout = QHBoxLayout()
        status_layout.addWidget(self.status_indicator)
        status_layout.addWidget(self.status_label)

        layout.addLayout(room_layout)
        layout.addWidget(self.connect_btn)
        layout.addLayout(status_layout)

        group.setLayout(layout)
        return group

    def create_rules_group(self):
        group = QGroupBox("⚙️ 自动回复规则")

        layout = QVBoxLayout()
        layout.setSpacing(10)

        self.enable_auto_reply = QCheckBox("启用自动回复")
        self.enable_auto_reply.setChecked(True)
        self.enable_auto_reply.stateChanged.connect(self.toggle_auto_reply)
        layout.addWidget(self.enable_auto_reply)

        self.rules_list = QListWidget()
        self.rules_list.setMaximumHeight(150)
        layout.addWidget(self.rules_list)

        btn_layout = QHBoxLayout()

        add_rule_btn = QPushButton("添加规则")
        add_rule_btn.clicked.connect(self.show_add_rule_dialog)
        add_rule_btn.setFixedHeight(32)
        btn_layout.addWidget(add_rule_btn)

        del_rule_btn = QPushButton("删除")
        del_rule_btn.clicked.connect(self.delete_selected_rule)
        del_rule_btn.setFixedHeight(32)
        del_rule_btn.setStyleSheet("background-color: #FF5252;")
        btn_layout.addWidget(del_rule_btn)

        layout.addLayout(btn_layout)

        group.setLayout(layout)
        return group

    def create_control_group(self):
        group = QGroupBox("🎮 控制面板")

        layout = QVBoxLayout()
        layout.setSpacing(10)

        self.clear_btn = QPushButton("清空弹幕")
        self.clear_btn.clicked.connect(self.clear_danmu)
        layout.addWidget(self.clear_btn)

        self.export_btn = QPushButton("导出历史")
        self.export_btn.clicked.connect(self.export_history)
        layout.addWidget(self.export_btn)

        group.setLayout(layout)
        return group

    def create_right_panel(self):
        right_widget = QWidget()

        layout = QVBoxLayout(right_widget)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)

        header = self.create_header()
        self.danmu_list_widget = AnimatedListWidget()
        self.danmu_list_widget.setSpacing(5)

        layout.addWidget(header)
        layout.addWidget(self.danmu_list_widget)

        return right_widget

    def create_header(self):
        header_widget = QWidget()
        header_widget.setFixedHeight(50)

        layout = QHBoxLayout(header_widget)
        layout.setContentsMargins(0, 0, 0, 0)

        title = QLabel("📺 实时弹幕")
        title.setFont(QFont("Microsoft YaHei", 16, QFont.Weight.Bold))
        title.setStyleSheet("color: #FFFFFF;")

        self.danmu_count_label = QLabel("弹幕数: 0")
        self.danmu_count_label.setStyleSheet("color: #B8B8B8;")

        self.reply_count_label = QLabel("回复数: 0")
        self.reply_count_label.setStyleSheet("color: #B8B8B8;")

        layout.addWidget(title)
        layout.addStretch()
        layout.addWidget(self.danmu_count_label)
        layout.addWidget(self.reply_count_label)

        return header_widget

    def create_status_bar(self):
        self.statusBar = QStatusBar()
        self.setStatusBar(self.statusBar)
        self.statusBar.showMessage("准备就绪")

    def init_connections(self):
        pass

    def toggle_connection(self):
        if self.douyin_api.is_connected:
            self.douyin_api.disconnect()
            self.connect_btn.setText("连接直播间")
            self.connect_btn.setEnabled(True)
            self.room_id_input.setEnabled(True)
        else:
            room_id = self.room_id_input.text().strip()
            if not room_id:
                QMessageBox.warning(self, "提示", "请输入直播间链接或房间号")
                return

            self.connect_btn.setEnabled(False)
            self.connect_btn.setText("连接中...")

            if self.douyin_api.connect(room_id):
                self.connect_btn.setText("断开连接")
                self.connect_btn.setEnabled(True)
                self.room_id_input.setEnabled(False)
            else:
                self.connect_btn.setText("连接直播间")
                self.connect_btn.setEnabled(True)
                QMessageBox.warning(self, "连接失败", "无法连接到直播间，请检查房间号是否正确")

    def handle_new_danmu(self, danmu):
        self.danmu_received.emit(danmu)

        self.database.save_danmu(danmu)

        self.display_danmu(danmu)

        reply = self.reply_engine.process_danmu(danmu)
        if reply:
            danmu['replied'] = True

        self.update_statistics()

    def display_danmu(self, danmu):
        item = QListWidgetItem()
        widget = DanmuItem(danmu)
        item.setSizeHint(QSize(widget.width(), 70))

        self.danmu_list_widget.addItem(item)
        self.danmu_list_widget.setItemWidget(item, widget)

        if self.danmu_list_widget.count() > self.max_danmu_display:
            self.danmu_list_widget.takeItem(0)

        self.danmu_list.append(danmu)

    def handle_status_change(self, message, is_connected):
        self.status_changed.emit(message, is_connected)

        if is_connected:
            self.status_indicator.set_status(True)
            self.status_label.setText(f"状态: {message}")
            self.connect_btn.setText("断开连接")
            self.connect_btn.setEnabled(True)
            self.room_id_input.setEnabled(False)
            self.statusBar.showMessage("已连接到直播间")
        else:
            self.status_indicator.set_status(False)
            self.status_label.setText(f"状态: {message}")
            self.connect_btn.setText("连接直播间")
            self.connect_btn.setEnabled(True)
            self.room_id_input.setEnabled(True)
            self.statusBar.showMessage(message)

    def handle_auto_reply(self, reply, danmu):
        self.douyin_api.send_reply(reply)

        self.statusBar.showMessage(f"已发送回复: {reply}")

    def toggle_auto_reply(self, state):
        if state == Qt.CheckState.Checked.value:
            self.reply_engine.enable()
            self.statusBar.showMessage("自动回复已启用")
        else:
            self.reply_engine.disable()
            self.statusBar.showMessage("自动回复已禁用")

    def show_add_rule_dialog(self):
        dialog = AddRuleDialog(self)
        if dialog.exec() == QDialog.DialogCode.Accepted:
            rule_data = dialog.get_rule_data()
            if self.reply_engine.add_rule(
                rule_data['keyword'],
                rule_data['replies'],
                rule_data['match_type']
            ):
                self.update_rules_display()
                QMessageBox.information(self, "成功", "规则添加成功")
            else:
                QMessageBox.warning(self, "失败", "规则添加失败")

    def update_rules_display(self):
        self.rules_list.clear()
        rules = self.reply_engine.get_rules()
        for rule in rules:
            status = "✓" if rule.get('enabled', True) else "✗"
            text = f"{status} {rule['keyword']} → {rule['replies'][0] if rule['replies'] else ''}"
            self.rules_list.addItem(text)

    def delete_selected_rule(self):
        current_item = self.rules_list.currentItem()
        if not current_item:
            QMessageBox.warning(self, "提示", "请先选择要删除的规则")
            return

        row = self.rules_list.row(current_item)
        rules = self.reply_engine.get_rules()

        if 0 <= row < len(rules):
            rule_id = rules[row]['id']
            if self.reply_engine.delete_rule(rule_id):
                self.update_rules_display()
                QMessageBox.information(self, "成功", "规则删除成功")
            else:
                QMessageBox.warning(self, "失败", "规则删除失败")

    def clear_danmu(self):
        self.danmu_list_widget.clear()
        self.danmu_list.clear()
        self.database.clear_danmu_history()
        self.update_statistics()
        self.statusBar.showMessage("弹幕列表已清空")

    def export_history(self):
        from PyQt6.QtWidgets import QFileDialog
        import json

        file_path, _ = QFileDialog.getSaveFileName(
            self, "导出历史", "", "JSON Files (*.json);;All Files (*)"
        )

        if file_path:
            history = self.database.get_danmu_history(limit=1000)
            try:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(history, f, ensure_ascii=False, indent=2)
                QMessageBox.information(self, "成功", f"历史记录已导出到:\n{file_path}")
            except Exception as e:
                QMessageBox.warning(self, "失败", f"导出失败:\n{str(e)}")

    def update_statistics(self):
        stats = self.database.get_statistics()
        self.danmu_count_label.setText(f"弹幕数: {stats['total_danmu']}")
        self.reply_count_label.setText(f"回复数: {stats['total_replies']}")

    def closeEvent(self, event):
        if self.douyin_api.is_connected:
            self.douyin_api.disconnect()
        event.accept()

class AddRuleDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("添加回复规则")
        self.setFixedSize(450, 350)
        self.init_ui()

    def init_ui(self):
        layout = QFormLayout(self)
        layout.setSpacing(15)

        self.keyword_input = QLineEdit()
        self.keyword_input.setPlaceholderText("输入触发关键词")

        self.match_type = QComboBox()
        self.match_type.addItems(["包含", "完全匹配", "正则表达式"])

        self.reply_input = QTextEdit()
        self.reply_input.setPlaceholderText("输入回复内容（支持多条，用|分隔）")
        self.reply_input.setMaximumHeight(100)

        self.add_btn = QPushButton("添加")
        self.add_btn.clicked.connect(self.validate_and_accept)

        self.cancel_btn = QPushButton("取消")
        self.cancel_btn.clicked.connect(self.reject)

        btn_layout = QHBoxLayout()
        btn_layout.addWidget(self.add_btn)
        btn_layout.addWidget(self.cancel_btn)

        layout.addRow("关键词:", self.keyword_input)
        layout.addRow("匹配方式:", self.match_type)
        layout.addRow("回复内容:", self.reply_input)
        layout.addRow(btn_layout)

    def validate_and_accept(self):
        keyword = self.keyword_input.text().strip()
        reply_text = self.reply_input.toPlainText().strip()

        if not keyword:
            QMessageBox.warning(self, "提示", "请输入关键词")
            return

        if not reply_text:
            QMessageBox.warning(self, "提示", "请输入回复内容")
            return

        self.accept()

    def get_rule_data(self):
        match_types = ['contain', 'exact', 'regex']
        replies = [r.strip() for r in self.reply_input.toPlainText().split('|') if r.strip()]

        return {
            'keyword': self.keyword_input.text().strip(),
            'match_type': match_types[self.match_type.currentIndex()],
            'replies': replies
        }

if __name__ == '__main__':
    app = QApplication(sys.argv)

    window = MainWindow()
    window.show()

    sys.exit(app.exec())
