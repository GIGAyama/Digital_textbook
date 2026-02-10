/**
 * Peta-tto! Digital Text - Server Side Logic
 * GIGA Standard v2 Compliant
 * (Updated: QR Code Support)
 */

const APP_NAME = 'デジタル教科書メーカー';
const SHEET_NAME_DATA = 'canvas_data';

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function doGet(e) {
  const props = PropertiesService.getScriptProperties();
  const isInitialized = props.getProperty('IS_INITIALIZED');

  if (!isInitialized) {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle(APP_NAME + ' - 初期設定')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 初期化処理
function initializeApp() {
  const ss = SpreadsheetApp.create(APP_NAME + '_DB');
  const sheet = ss.getSheets()[0];
  sheet.setName(SHEET_NAME_DATA);
  
  const headers = ['page_index', 'data_json', 'updated_at', 'deleted_at'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, sheet.getMaxRows(), headers.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);

  const props = PropertiesService.getScriptProperties();
  props.setProperty('SPREADSHEET_ID', ss.getId());
  props.setProperty('IS_INITIALIZED', 'true');

  return { url: ss.getUrl() };
}

function getAppState() {
  const props = PropertiesService.getScriptProperties();
  const isInitialized = props.getProperty('IS_INITIALIZED');
  if (!isInitialized) return { isInitialized: false };

  const pres = SlidesApp.getActivePresentation();
  const slides = pres.getSlides();
  const hasContent = slides.length > 1 || (slides.length === 1 && slides[0].getBackground().getPictureFill() !== null);

  return {
    isInitialized: true,
    hasContent: hasContent,
    pageCount: slides.length
  };
}

// --- Data Loader ---

function getInitialData() {
  const pres = SlidesApp.getActivePresentation();
  const slides = pres.getSlides();
  const width = pres.getPageWidth();
  const height = pres.getPageHeight();
  
  const imageUrls = slides.map(slide => {
    const bg = slide.getBackground();
    const fill = bg.getPictureFill();
    return fill ? fill.getContentUrl() : null;
  });

  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_NAME_DATA);
  const data = sheet.getDataRange().getValues();
  
  const drawings = {};
  for (let i = 1; i < data.length; i++) {
    const pIndex = data[i][0];
    const json = data[i][1];
    const deleted = data[i][3];
    if (deleted === '') {
      drawings[pIndex] = json;
    }
  }

  return {
    imageUrls: imageUrls,
    drawings: drawings,
    width: width,
    height: height,
    totalPages: slides.length
  };
}

// QR解析用に、指定ページの画像をBase64で取得する関数
// (クライアント側のCanvas汚染回避のためサーバー経由で取得)
function getPageImageBase64(pageIndex) {
  const pres = SlidesApp.getActivePresentation();
  const slides = pres.getSlides();
  if (pageIndex < 0 || pageIndex >= slides.length) throw new Error('ページが見つかりません');
  
  const slide = slides[pageIndex];
  const bg = slide.getBackground();
  const fill = bg.getPictureFill();
  
  if (!fill) return null;
  
  const blob = fill.getBlob();
  const base64 = Utilities.base64Encode(blob.getBytes());
  return 'data:' + blob.getContentType() + ';base64,' + base64;
}

// --- Import Logic ---

function initPresentationConfig(width, height) {
  const pres = SlidesApp.getActivePresentation();
  while (pres.getSlides().length > 0) pres.getSlides()[0].remove();
  if (pres.getSlides().length === 0) pres.appendSlide();
  return { success: true };
}

function appendSlidePage(base64, index) {
  const pres = SlidesApp.getActivePresentation();
  let slide;
  const slides = pres.getSlides();
  if (index === 0 && slides.length === 1) {
    slide = slides[0];
  } else {
    slide = pres.appendSlide();
  }
  
  const contentType = base64.substring(5, base64.indexOf(';'));
  const bytes = Utilities.base64Decode(base64.substring(base64.indexOf(',') + 1));
  const blob = Utilities.newBlob(bytes, contentType, `page_${index}.png`);
  
  slide.getBackground().setPictureFill(blob);
  return { success: true, page: index + 1 };
}

function setupSlideFromDriveFolder(folderUrlOrId) {
  let folderId = folderUrlOrId;
  if (folderUrlOrId.includes('folders/')) {
    const parts = folderUrlOrId.split('folders/');
    if (parts.length > 1) folderId = parts[1].split(/[/?]/)[0];
  }

  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    const sortedFiles = [];
    
    while (files.hasNext()) {
      const f = files.next();
      if (f.getMimeType().startsWith('image/')) sortedFiles.push(f);
    }

    if (sortedFiles.length === 0) throw new Error('画像が見つかりませんでした。');

    sortedFiles.sort((a, b) => a.getName().localeCompare(b.getName(), undefined, {numeric: true, sensitivity: 'base'}));

    const pres = SlidesApp.getActivePresentation();
    while(pres.getSlides().length > 0) pres.getSlides()[0].remove();
    if(pres.getSlides().length === 0) pres.appendSlide();

    sortedFiles.forEach((file) => {
      const slide = pres.appendSlide();
      slide.getBackground().setPictureFill(file.getBlob());
    });

    if (pres.getSlides().length > sortedFiles.length) pres.getSlides()[0].remove();

    return { success: true, count: sortedFiles.length };

  } catch (e) {
    throw new Error('フォルダ読み込み失敗: ' + e.message);
  }
}

function savePageData(pageIndex, json) {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('SPREADSHEET_ID');
  const ss = SpreadsheetApp.openById(ssId);
  const sheet = ss.getSheetByName(SHEET_NAME_DATA);
  const now = new Date();
  sheet.appendRow([pageIndex, json, now, '']);
  return { success: true };
}
