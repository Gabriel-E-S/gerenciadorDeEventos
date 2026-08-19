import axios from 'axios';

const api = axios.create({
    baseURL: 'https://gerenciadordeeventos.onrender.com'
});

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

api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; 

            try {
                const refreshToken = localStorage.getItem('refreshToken');
                
                if (!refreshToken) {
                    forcarLogout();
                    return Promise.reject(error);
                }

                const respostaRefresh = await axios.post('https://gerenciadordeeventos.onrender.com/api/auth/refresh', { 
                    refreshToken 
                });
                
                if (respostaRefresh.data.token) {
            
                    localStorage.setItem('tokenSessao', respostaRefresh.data.token);
                    
                    if (respostaRefresh.data.refreshToken) {
                        localStorage.setItem('refreshToken', respostaRefresh.data.refreshToken);
                    }
                    
                    originalRequest.headers['Authorization'] = `Bearer ${respostaRefresh.data.token}`;
                    
                    return api(originalRequest);
                }
            } catch (refreshError) {
                forcarLogout();
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

function forcarLogout() {
    localStorage.removeItem('tokenSessao');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('dadosUsuario');
    window.location.href = '/login'; 
}

export default api;