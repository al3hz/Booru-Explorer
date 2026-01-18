export default async function handler(request, response) {
    const { url } = request;
    // Extraer los query params de la URL de la solicitud
    // La URL viene como /api/danbooru?path=/posts.json&tags=...
    // O podemos usar un estilo más directo si configuramos rewrites, pero por simplicidad:
    // Vamos a esperar llamadas tipo: /api/danbooru?url=posts.json&other_params...

    const urlParams = new URLSearchParams(url.split('?')[1]);
    const targetPath = urlParams.get('url') || 'posts.json'; // Default to posts.json

    // Eliminar 'url' de los params para que no se envíe a Danbooru
    urlParams.delete('url');

    // Construir la URL final de Danbooru
    const danbooruUrl = `https://danbooru.donmai.us/${targetPath}?${urlParams.toString()}`;

    try {
        const res = await fetch(danbooruUrl, {
            headers: {
                'User-Agent': 'Booru-Explorer/1.0 (PROYECTO_EDUCATIVO)',
                'Content-Type': 'application/json',
            },
        });

        // Si Danbooru nos limita (429), devolvemos el error tal cual
        if (res.status === 429) {
            return response.status(429).json({ error: 'Danbooru Rate Limit Exceeded' });
        }

        const data = await res.json();

        // Configurar Cache-Control
        // s-maxage=300 -> 5 minutos en CDN Vercel
        // stale-while-revalidate=60 -> sirve contenido viejo por 1 min extra mientras revalida
        response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

        return response.status(res.status).json(data);
    } catch (error) {
        console.error('Error proxying to Danbooru:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
