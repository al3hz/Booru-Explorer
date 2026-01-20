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
                'User-Agent': 'Booru-Explorer/1.0 (Educational Project; al3hz)',
                'Content-Type': 'application/json',
            },
        });

        // Handle errors from Danbooru
        if (!res.ok) {
            const errorText = await res.text();
            console.error(`Danbooru Error ${res.status}:`, errorText.slice(0, 500));

            // Try to parse as JSON if possible, otherwise return generic
            try {
                const errorJson = JSON.parse(errorText);
                return response.status(res.status).json(errorJson);
            } catch {
                return response.status(res.status).json({
                    error: `Danbooru API returned ${res.status}`,
                    message: errorText.slice(0, 200)
                });
            }
        }

        const data = await res.json();

        // Configurar Cache-Control
        response.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');

        return response.status(200).json(data);
    } catch (error) {
        console.error('Error proxying to Danbooru:', error);
        return response.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
}
