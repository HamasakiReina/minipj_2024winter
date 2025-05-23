document.addEventListener('DOMContentLoaded', () => {
  const usernameDisplay = document.getElementById('usernameDisplay');
  const logoutBtn = document.getElementById('logoutBtn');
  const startRecordingBtn = document.getElementById('startRecordingBtn');
  const stopRecordingBtn = document.getElementById('stopRecordingBtn');
  const transcriptionDiv = document.getElementById('transcription');
  const fileInput = document.getElementById('fileInput');
  const historyList = document.getElementById('historyList');
  const overlay = document.createElement('div');

  let mediaRecorder = null;
  let audioChunks = [];
  let audioStream = null;

  overlay.id = 'processingOverlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(50, 50, 50, 0.8)';
  overlay.style.color = '#fff';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';
  overlay.style.alignItems = 'center';
  overlay.style.fontSize = '24px';
  overlay.style.fontWeight = 'bold';
  overlay.style.zIndex = '1000';
  overlay.style.visibility = 'hidden';
  overlay.textContent = '処理中...';
  document.body.appendChild(overlay);

  function showProcessingOverlay() {
    overlay.style.visibility = 'visible';
  }

  function hideProcessingOverlay() {
    overlay.style.visibility = 'hidden';
  }

  if (usernameDisplay) {
    const username = localStorage.getItem('username') || 'ゲスト';
    usernameDisplay.textContent = username;
  }

  startRecordingBtn.addEventListener('click', async () => {
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(audioStream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await uploadAudio(audioBlob);
      };

      mediaRecorder.start();
      startRecordingBtn.disabled = true;
      stopRecordingBtn.disabled = false;
    } catch (error) {
      console.error('マイクの使用に失敗しました:', error);
    }
  });

  stopRecordingBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
        audioStream = null;
      }
      startRecordingBtn.disabled = false;
      stopRecordingBtn.disabled = true;
    }
  });

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
      await uploadAudio(file);
    }
  });

  async function uploadAudio(file) {
    const formData = new FormData();
    formData.append('audio', file);

    showProcessingOverlay();
    startRecordingBtn.disabled = true;
    stopRecordingBtn.disabled = true;

    try {
      const response = await fetch('/upload', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.transcription) {
        transcriptionDiv.textContent = data.transcription;
        saveHistory(data.transcription);
      } else {
        transcriptionDiv.textContent = '文字起こし結果がありません';
      }
    } catch (error) {
      console.error('エラー:', error);
      transcriptionDiv.textContent = '文字起こしに失敗しました';
    } finally {
      hideProcessingOverlay();
      startRecordingBtn.disabled = false;
      stopRecordingBtn.disabled = true;
    }
  }

  function saveHistory(text) {
    const timestamp = new Date().toLocaleString();
    const historyItem = document.createElement('li');
    historyItem.innerHTML = `
      <strong>${timestamp}</strong><br>
      ${text} <br>
      <a href="#" class="downloadLink" data-text="${text}" download="transcription_${timestamp.replace(/[/\s:]/g, '_')}.txt">ダウンロード</a>
    `;
    historyList.appendChild(historyItem);

    historyItem.querySelector('.downloadLink').addEventListener('click', function (event) {
      event.preventDefault();
      const blob = new Blob([this.dataset.text], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = this.download;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
});
