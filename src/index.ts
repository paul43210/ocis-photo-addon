/**
 * oCIS Photo Add-on
 * 
 * Adds a PhotoView to the oCIS web interface that displays
 * photos grouped by date with non-image files filtered out.
 */

import { defineWebApplication } from '@ownclouders/web-pkg'
import PhotoView from './components/PhotoView.vue'

export default defineWebApplication({
  setup() {
    return {
      appInfo: {
        name: 'Photo View',
        id: 'photo-addon',
        icon: 'image',
        color: '#339900'
      },
      
      // Register as a folder view extension
      extensions: [
        {
          id: 'com.github.ocis-photo-addon.folder-view',
          type: 'folderView',
          scopes: ['resource', 'space', 'favorite', 'share'],
          folderView: {
            name: 'photo-view',
            label: 'Photo View',
            icon: {
              name: 'image',
              fillType: 'line'
            },
            component: PhotoView,
            componentAttrs: {}
          }
        }
      ]
    }
  }
})
