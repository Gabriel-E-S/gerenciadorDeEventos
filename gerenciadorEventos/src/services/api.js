import axios from 'axios';

// Cria uma instância global do Axios com a sua URL base
const api = axios.create({
    baseURL: 'https://gerenciadordeeventos.onrender.com'
});

// ==========================================
// INTERCEPTOR DE REQUISIÇÃO (A Ida)
// ==========================================
// Antes de qualquer requisição sair do React, ele injeta o Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('tokenSessao');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ==========================================
// INTERCEPTOR DE RESPOSTA (A Volta)
// ==========================================
// Lê a resposta do Backend. Se der erro 401, faz a mágica da renovação.
api.interceptors.response.use(
    (response) => {
        // Se a requisição deu certo, simplesmente devolve a resposta
        return response;
    },
    async (error) => {
        // Pega as configurações da requisição original que acabou de falhar
        const originalRequest = error.config;

        // Se o erro for 401 (Token Expirado) e nós ainda não tentamos renovar (_retry evita loop infinito)
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; // Marca que estamos tentando reanimar essa requisição

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                
                if (!refreshToken) {
                    forcarLogout();
                    return Promise.reject(error);
                }

                // Dispara uma chamada paralela e silenciosa para renovar o token
                const respostaRefresh = await axios.post('https://gerenciadordeeventos.onrender.com/api/auth/refresh', { 
                    refreshToken 
                });
                
                if (respostaRefresh.data.token) {
                    // Guarda o novo token de 15 minutos
                    localStorage.setItem('tokenSessao', respostaRefresh.data.token);
                    
                    // Atualiza a requisição original que estava pausada com o novo token
                    originalRequest.headers['Authorization'] = `Bearer ${respostaRefresh.data.token}`;
                    
                    // Refaz a requisição original e a devolve como se nada tivesse acontecido!
                    return api(originalRequest);
                }
            } catch (refreshError) {
                // Se o Refresh Token expirou (passou de 7 dias) ou a pessoa foi banida
                forcarLogout();
                return Promise.reject(refreshError);
            }
        }

        // Retorna outros tipos de erro (404, 500, etc) para o componente tratar
        return Promise.reject(error);
    }
);

function forcarLogout() {
    localStorage.removeItem('tokenSessao');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('dadosUsuario');
    window.location.href = '/login'; // Chuta o usuário para a tela de login
}

export default api;