type ImageGenerateRequest = {
  model: string;
  prompt: string;
  n: number;
  size: string;
};

export default class OpenAI {
  images = {
    generate: async (request: ImageGenerateRequest) => {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as { image?: string };
      if (!payload.image) throw new Error('No image returned');

      const b64Json = payload.image.startsWith('data:')
        ? payload.image.slice(payload.image.indexOf(',') + 1)
        : payload.image;

      return { data: [{ b64_json: b64Json }] };
    },
  };

  constructor(options: {
    apiKey?: string;
    dangerouslyAllowBrowser?: boolean;
  }) {
    void options;
  }
}
