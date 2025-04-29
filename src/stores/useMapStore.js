import { defineStore } from 'pinia';

export const useMapStore = defineStore('map', {
  state: () => ({
    lastClick: null,
    sessionClick: null,
    allClicks: [],
  }),
	
  actions: {
    setClick(data) {
      this.lastClick = data;
      this.sessionClick = data;
      this.allClicks.push(data);
      localStorage.setItem('mapStore', JSON.stringify({
        lastClick: this.lastClick,
        allClicks: this.allClicks,
      }));
    },
		
    loadFromStorage() {
      const stored = localStorage.getItem('mapStore');
      if (stored) {
        const data = JSON.parse(stored);
        this.lastClick = data.lastClick;
        this.allClicks = data.allClicks;
        this.sessionClick = null;
      }
    },

    clearSessionClick() {
      this.sessionClick = null;
    },
  },
});
