import { point } from '@turf/helpers'
import distance from '@turf/distance'
export function findNearest(current, exhibits) {
  const currentPoint = point(current)
  let minDist = Infinity, nearest = null
  exhibits.forEach(ex => {
    const exPoint = point(ex.coords)
    const dist = distance(currentPoint, exPoint)
    if (dist < minDist) { minDist = dist; nearest = ex }
  })
  return nearest
}
