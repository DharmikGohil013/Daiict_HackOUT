import api from './api';

export const configService = {
  async enums() {
    const { data } = await api.get('/api/config/enums');
    return data;
  },
};

export default configService;
