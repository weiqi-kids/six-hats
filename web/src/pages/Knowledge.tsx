/**
 * 個人知識庫管理頁面
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { attachmentApi, type Attachment } from '../api/six-hats';

const SOURCE_TYPE_LABELS: Record<string, string> = {
  file: '檔案',
  url: '網址',
  text: '文字',
};

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  processing: { text: '處理中...', color: 'text-yellow-600' },
  ready: { text: '就緒', color: 'text-green-600' },
  error: { text: '失敗', color: 'text-red-600' },
};

export default function Knowledge() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 文字/URL 輸入
  const [showTextInput, setShowTextInput] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');

  useEffect(() => {
    loadAttachments();
  }, []);

  const loadAttachments = async () => {
    try {
      const data = await attachmentApi.list();
      setAttachments(data.attachments);
    } catch (err) {
      setError('載入附件失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const data = await attachmentApi.uploadFile(file);
      setAttachments((prev) => [data.attachment, ...prev]);
    } catch (err) {
      setError('上傳失敗');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddText = async () => {
    if (!textInput.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const data = await attachmentApi.addText(textInput, textTitle || undefined);
      setAttachments((prev) => [data.attachment, ...prev]);
      setTextInput('');
      setTextTitle('');
      setShowTextInput(false);
    } catch (err) {
      setError('新增文字失敗');
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const data = await attachmentApi.addUrl(urlInput);
      setAttachments((prev) => [data.attachment, ...prev]);
      setUrlInput('');
      setShowUrlInput(false);
    } catch (err) {
      setError('抓取網址失敗');
    } finally {
      setUploading(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const result = await attachmentApi.toggle(id);
      setAttachments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled: result.enabled } : a))
      );
    } catch (err) {
      setError('切換失敗');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此知識？向量資料也會一併移除。')) return;
    try {
      await attachmentApi.delete(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError('刪除失敗');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-bold text-lg flex-1">我的知識庫</h1>
          <span className="text-sm text-gray-500">
            {attachments.filter((a) => a.enabled).length} / {attachments.length} 啟用
          </span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* 上傳區 */}
        <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
          <h2 className="font-medium text-gray-700 mb-3">新增知識</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              上傳檔案
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.md,.txt,.text"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => { setShowUrlInput(!showUrlInput); setShowTextInput(false); }}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              貼上網址
            </button>
            <button
              onClick={() => { setShowTextInput(!showTextInput); setShowUrlInput(false); }}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
            >
              貼上文字
            </button>
          </div>

          <p className="mt-2 text-xs text-gray-400">
            支援 PDF、Word、Markdown、純文字、網址。上傳的知識會自動用於所有分析。
          </p>

          {/* URL 輸入 */}
          {showUrlInput && (
            <div className="mt-3 flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddUrl}
                disabled={uploading || !urlInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {uploading ? '抓取中...' : '抓取'}
              </button>
            </div>
          )}

          {/* 文字輸入 */}
          {showTextInput && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="標題（選填）"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="貼上你的文字內容..."
                rows={5}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              <button
                onClick={handleAddText}
                disabled={uploading || !textInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {uploading ? '處理中...' : '新增'}
              </button>
            </div>
          )}
        </div>

        {/* 附件列表 */}
        {loading ? (
          <div className="text-center text-gray-500 py-8">載入中...</div>
        ) : attachments.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <div className="text-4xl mb-2">📚</div>
            <p>還沒有任何知識</p>
            <p className="text-sm mt-1">上傳文件或貼上網址，讓 AI 分析更貼近你的專業</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const status = STATUS_LABELS[attachment.status] || STATUS_LABELS.error;
              return (
                <div
                  key={attachment.id}
                  className={`bg-white rounded-lg p-4 border border-gray-200 flex items-center gap-4 ${
                    !attachment.enabled ? 'opacity-60' : ''
                  }`}
                >
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(attachment.id)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${
                      attachment.enabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                        attachment.enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {attachment.originalName || attachment.filename}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span>{SOURCE_TYPE_LABELS[attachment.sourceType] || attachment.sourceType}</span>
                      <span>{attachment.chunkCount} 段</span>
                      <span className={status.color}>{status.text}</span>
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(attachment.id)}
                    className="p-2 text-gray-400 hover:text-red-500 transition"
                    title="刪除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 錯誤提示 */}
      {error && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-white/80 hover:text-white">
            x
          </button>
        </div>
      )}
    </div>
  );
}
