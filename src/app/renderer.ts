import {IFileOpen} from "../common/interface/IFileOpen";
import "./menu.right";
import "./key.event";
import {createTerminal} from './plugins/terminal';
import {createEvent} from "./utils/event.util";
import {markdownRender, removeLastDirectoryPartOf} from "./utils/markdown.utils";
import {getCodeMirrorMode} from "./utils/file.utils";
import {EventConstants} from "../common/constants/event.constants";

// require("devtron").install();

declare global {
  interface Window {
    simplemde: any
  }
}

const {ipcRenderer} = require("electron");
const swal = require("sweetalert");

class ClientUI {
  state = {
    isShowTerminal: false,
    hasCreateTerminal: false,
    currentFile: '',
    isCurrentFileTemp: false,
    isOneFile: false,
    isPath: false
  };

  simplemde = new (window as any).SimpleMDE({
    spellChecker: false,
    autosave: {
      enabled: true,
      uniqueId: "phodit",
      delay: 1000,
    },
    promptTexts: {
      link: 'link',
      image: 'image'
    },
    autoDownloadFontAwesome: false,
    renderingConfig: {
      codeSyntaxHighlighting: true
    },
    element: document.getElementById("input-section"),
  });

  init () {
    (window as any).simplemde = this.simplemde;
   // @ts-ignore
    const clipboard = new ClipboardJS('.wechat-button');

    clipboard.on('success', function (event: any) {
      swal({
        title: "Copy Success", icon: "success", dangerMode: true,
        buttons: {
          confirm: {text: "OK"}
        }
      });
      event.clearSelection();
    });
  }

  updatePos(currentFile: string) {
    let lastPos = localStorage.getItem("line_" + currentFile);
    if (lastPos) {
      let parsedPos = JSON.parse(lastPos);
      this.simplemde.codemirror.setCursor(parsedPos.line, parsedPos.ch);
    }
  }

  bindEvent () {
    // 打开帮助
    window.document.addEventListener(EventConstants.CLIENT.OPEN_GUIDE, (data) => {
      ipcRenderer.send(EventConstants.PHODIT.OPEN_GUIDE, this.simplemde.value());
    });

    // 全屏
    window.document.addEventListener(EventConstants.CLIENT.FULL_SCREEN, (data) => {
      document.getElementById('input').classList.add('full-screen');
      ipcRenderer.send(EventConstants.PHODIT.FULL_SCREEN);
    });

    // 取消全屏
    window.document.addEventListener(EventConstants.CLIENT.UN_FULL_SCREEN, (data) => {
      document.getElementById('input').classList.remove('full-screen');
      ipcRenderer.send(EventConstants.PHODIT.UN_FULL_SCREEN);
    });

    // Terminal show
    window.document.addEventListener(EventConstants.CLIENT.SHOW_TERMINAL, () => {
      if (!this.state.hasCreateTerminal) {
        createTerminal(removeLastDirectoryPartOf(this.state.currentFile));
        this.state.hasCreateTerminal = true;
      }

      this.state.isShowTerminal = !this.state.isShowTerminal;
      if (this.state.isShowTerminal) {
        document.getElementById('terminal-section').setAttribute('style', "display: block;");
      } else {
        document.getElementById('terminal-section').setAttribute('style', "display: none;");
      }
    });

    // Terminal hidden
    window.document.addEventListener(EventConstants.CLIENT.HIDDEN_TERMINAL, () => {
      document.getElementById('terminal-section').setAttribute('style', "display: none;");
    });

    // ShowSlides
    window.document.addEventListener(EventConstants.CLIENT.SHOW_SLIDES, () => {
      if (!this.state.currentFile) {
        return;
      }
      ipcRenderer.send(EventConstants.PHODIT.SHOW_SLIDES, {
        isTempFile: this.state.isCurrentFileTemp,
        file: this.state.currentFile,
        data: this.simplemde.value(),
      });
    });

    // 隐藏 SIDE
    window.document.addEventListener(EventConstants.CLIENT.HIDDEN_SIDE, () => {
      document.getElementById('tree-view').setAttribute('style', "display: none;");
      document.querySelector(".wechat-button").setAttribute("data-clipboard-target", ".editor-preview-side")
    });

    // 展示 SIDE
    window.document.addEventListener(EventConstants.CLIENT.SHOW_SIDE, () => {
      document.querySelector(".wechat-button").removeAttribute("data-clipboard-target")
      if (this.state.isPath) {
        document.getElementById('tree-view').setAttribute('style', "display: block;");
      }
    });

    // 发起获取自动完成请求
    window.document.addEventListener(EventConstants.CLIENT.GET_SUGGEST, (data: any) => {
      ipcRenderer.send(EventConstants.PHODIT.GET_SUGGEST, data.detail);
    });

    // 打开左侧树型文件
    window.document.addEventListener(EventConstants.CLIENT.TREE_OPEN, (event: any) => {
      let file = JSON.parse(event.detail).filename;
      this.state.currentFile = file;
      this.state.isOneFile = true;

      ipcRenderer.send(EventConstants.PHODIT.SAVE_FILE, {
        isTempFile: this.state.isCurrentFileTemp,
        data: this.simplemde.value(),
      });
      ipcRenderer.send(EventConstants.PHODIT.OPEN_FILE, file);
    });

    // 返回 Markdown 渲染结果
    window.document.addEventListener(EventConstants.CLIENT.SEND_MARKDOWN, (event: any) => {
      const data = markdownRender(event.detail, this.state.currentFile);
      createEvent(EventConstants.CLIENT.GET_RENDERER_MARKDOWN, data);
    });

    // Pandoc 转换
    window.document.addEventListener(EventConstants.CLIENT.SHOW_WORD, (event: any) => {
      swal({
        title: "Open File", text: "Are you want to Open File", icon: "info", dangerMode: true,
        buttons: {
          cancel: {text: "Cancel", visible: true},
          confirm: {text: "OK"}
        }
      }).then((willDelete: any) => {
        if (willDelete) {
          ipcRenderer.send(EventConstants.PHODIT.SHOW_WORD, this.state.currentFile);
        }
      });
    });

    // Pandoc 转换
    window.document.addEventListener(EventConstants.CLIENT.SHOW_PDF, (event: any) => {
      swal({
        title: "Open File", text: "Are you want to Open File", icon: "info", dangerMode: true,
        buttons: {
          cancel: {text: "Cancel", visible: true},
          confirm: {text: "OK"}
        }
      }).then((willDelete: any) => {
        if (willDelete) {
          ipcRenderer.send(EventConstants.PHODIT.SHOW_PDF, this.state.currentFile);
        }
      });
    });

    // 返回获取自动完成请求
    ipcRenderer.on(EventConstants.PHODIT.SUGGEST_SEND, (event: any, arg: any) => {
      createEvent(EventConstants.PHODIT.SUGGEST_TO_EDITOR, arg);
    });

    // 打开文件
    ipcRenderer.on(EventConstants.PHODIT.OPEN_ONE_FILE, (event: any, arg: IFileOpen) => {
      this.state.currentFile = arg.file;
      this.state.isOneFile = true;
      this.simplemde.codemirror.setOption("mode", getCodeMirrorMode(this.state.currentFile));
      this.state.isCurrentFileTemp = arg.isTempFile;
      this.simplemde.value(arg.data);
      this.updatePos(arg.file);

      localStorage.setItem('currentFile', arg.file);
    });

    // 保存文件
    ipcRenderer.on(EventConstants.CLIENT.SAVE_FILE, () => {
      ipcRenderer.send(EventConstants.PHODIT.SAVE_FILE, {
        isTempFile: this.state.isCurrentFileTemp,
        data: this.simplemde.value(),
      });
    });

    // 打开某一目录
    ipcRenderer.on(EventConstants.PHODIT.OPEN_PATH, (event: any, arg: any) => {
      this.state.isPath = true;
      document.getElementById('tree-view').setAttribute('style', "display: block");

      createEvent("phodit.tree.open", {
        path: arg.path,
        tree: arg.tree
      });
    });

    // 改变临时文件的状态
    ipcRenderer.on(EventConstants.TEMP_FILE_STATUS, (event: any, arg: any) => {
      this.state.isCurrentFileTemp = arg.isTempFile;
    });
  };
}

let client = new ClientUI();
client.init();
client.bindEvent();
