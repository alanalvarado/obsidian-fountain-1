export class App {
  workspace = {
    trigger: jest.fn(),
    requestSaveLayout: jest.fn(),
    getLeaf: jest.fn().mockReturnValue({
      openFile: jest.fn(),
    }),
  };
  metadataCache = {
    getFirstLinkpathDest: jest.fn(),
    fileToLinktext: jest.fn(),
  };
  vault = {
    getFiles: jest.fn().mockReturnValue([]),
    create: jest.fn(),
    read: jest.fn().mockResolvedValue(""),
    modify: jest.fn().mockResolvedValue(undefined),
  };
  fileManager = {
    getNewFileParent: jest.fn(),
  };
}

export class Notice {
  constructor(public message: string) {}
}

export class TFile {
  path = "";
  basename = "";
  extension = "";
}

export class Menu {
  items: any[] = [];
  addItem(cb: (item: any) => void) {
    const item = {
      setTitle: jest.fn().mockReturnThis(),
      setChecked: jest.fn().mockReturnThis(),
      onClick: jest.fn().mockReturnThis(),
    };
    cb(item);
    this.items.push(item);
    return this;
  }
  addSeparator() {
    return this;
  }
  showAtMouseEvent() {}
}

export const setIcon = jest.fn();

export class ItemView {
  constructor(public leaf: any) {}
}

export class TextFileView extends ItemView {
  app: App;
  file: TFile | null = null;
  contentEl: HTMLElement;
  scope: any;
  constructor(leaf: any) {
    super(leaf);
    this.app = new App();
    this.contentEl = {
      addEventListener: jest.fn(),
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
    } as any;
  }
  addAction = jest.fn().mockReturnValue({
    hide: jest.fn(),
    show: jest.fn(),
  });
  requestSave = jest.fn();
}

export class Scope {
  constructor(public parent?: any) {}
  register = jest.fn();
}

export class Modal {
  constructor(public app: App) {}
  open = jest.fn();
  close = jest.fn();
}

export class Setting {
  constructor(public containerEl: HTMLElement) {}
  setName = jest.fn().mockReturnThis();
  setDesc = jest.fn().mockReturnThis();
  addText = jest.fn().mockReturnThis();
  addButton = jest.fn().mockReturnThis();
  addToggle = jest.fn().mockReturnThis();
}

export class ButtonComponent {
  setButtonText = jest.fn().mockReturnThis();
  onClick = jest.fn().mockReturnThis();
  setCta = jest.fn().mockReturnThis();
}

export class TextComponent {
  setValue = jest.fn().mockReturnThis();
  onChange = jest.fn().mockReturnThis();
}

export class FuzzySuggestModal extends Modal {
  constructor(app: App) {
    super(app);
  }
}

export function debounce(cb: any) {
  return cb;
}
