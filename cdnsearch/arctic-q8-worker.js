import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1';

let extractor, prefix;
async function encode(text) {
  const result = await extractor(prefix + text, { pooling: 'cls', normalize: true });
  return Float32Array.from(result.data);
}

// Transformers.js caches the decoded ONNX by its logical URL. Adapt just that
// request to our gzip asset inside this dedicated worker.
function usePackedWeights(url, transferBytes, decodedBytes) {
  const fetchFile = self.fetch.bind(self);
  self.fetch = async (input, options) => {
    if ((input instanceof Request ? input.url : String(input)) !== url) return fetchFile(input, options);
    const response = await fetchFile(url + '.gz', options);
    if (!response.ok) return response;
    let loaded = 0, lastPercent = -1;
    const meter = new TransformStream({ transform(chunk, controller) {
      loaded += chunk.byteLength;
      const percent = Math.floor(100 * loaded / transferBytes);
      if (percent !== lastPercent) {
        self.postMessage({ type: 'progress', loaded });
        lastPercent = percent;
      }
      controller.enqueue(chunk);
    } });
    const decoded = response.body.pipeThrough(meter).pipeThrough(new DecompressionStream('gzip'));
    return new Response(decoded, { headers: { 'Content-Length': String(decodedBytes) } });
  };
}

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'load') {
      // A saved-model start is cache-only for remote assets. Transformers.js requires
      // local model access to be enabled when local_files_only is set.
      env.allowLocalModels = data.saved;
      env.remoteHost = data.modelBase;
      env.remotePathTemplate = '{model}/';
      env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/';
      prefix = data.prefix;
      let lastPercent = -1;
      const model = data.model || 'arctic-l';
      const packed = model === 'arctic-l-q8-travel';
      if (packed) usePackedWeights(data.modelBase + model + '/onnx/model_quantized.onnx', data.modelBytes, 379535742);
      extractor = await pipeline('feature-extraction', model, {
        dtype: 'q8', device: 'wasm', local_files_only: data.saved,
        progress_callback(event) {
          if (event.file !== 'onnx/model_quantized.onnx') return;
          if (event.status === 'progress' && !packed) {
            const percent = Math.floor(100 * event.loaded / data.modelBytes);
            if (percent === lastPercent) return;
            lastPercent = percent;
            self.postMessage({ type: 'progress', loaded: event.loaded });
          } else if (event.status === 'done') self.postMessage({ type: 'preparing' });
        }
      });
      self.postMessage({ type: 'preparing' });
      const warm = await encode('warm up');
      if (warm.length !== data.dim || !warm.every(Number.isFinite)) throw Error('Invalid model output');
      self.postMessage({ type: 'ready' });
    } else {
      const vector = await encode(data.text);
      self.postMessage({ type: 'embedding', vector }, [vector.buffer]);
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message || String(error) });
  }
};
