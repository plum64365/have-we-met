import { PHOTO_MAX_CHARS } from '../shared/community.ts'

/** Re-encode selected images as bounded JPEGs before they leave the device. */
export async function preparePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.size > 20_000_000)
    throw new Error('Choose an image smaller than 20 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not prepare the photo.')
    let scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight))
    let photo: string
    do {
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      photo = canvas.toDataURL('image/jpeg', 0.72)
      scale *= 0.8
    } while (photo.length > PHOTO_MAX_CHARS && Math.max(canvas.width, canvas.height) > 240)
    if (photo.length > PHOTO_MAX_CHARS) throw new Error('This photo is too large. Try a smaller image.')
    return photo
  } catch (error) {
    if (error instanceof Error && error.name !== 'EncodingError') throw error
    throw new Error('This image could not be opened. Try a JPEG or PNG photo.', { cause: error })
  } finally {
    URL.revokeObjectURL(url)
  }
}
