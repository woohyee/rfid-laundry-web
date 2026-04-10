const { onSchedule } = require('firebase-functions/v2/scheduler')
const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { getStorage } = require('firebase-admin/storage')

initializeApp()
const db = getFirestore()
const bucket = getStorage().bucket()

// 자동 삭제 기준일
const AUTO_DELETE_DAYS = {
  resolved: 5,       // resolvedAt 이후 5일
  unclaimed: 30,     // 미해결 foundItem 30일
  announcement: 0,   // expiresAt 기준 (만료 즉시)
}

/**
 * 매일 오전 3시 (UTC) 실행
 * - resolvedAt + 5일 경과한 lostReports, foundItems 삭제
 * - 30일 이상 미해결 foundItems 삭제
 * - 만료된 announcements 삭제
 */
exports.cleanupExpired = onSchedule('every day 03:00', async () => {
  const now = new Date()
  let deleted = 0

  // 1. resolved 후 5일 경과한 lostReports 삭제
  deleted += await deleteExpiredResolved('lostReports', now)

  // 2. resolved 후 5일 경과한 foundItems 삭제 (+ 서브컬렉션 claims)
  deleted += await deleteExpiredFoundItems(now)

  // 3. 30일 이상 미해결 foundItems 삭제
  deleted += await deleteUnclaimedFoundItems(now)

  // 4. 만료된 announcements 삭제
  deleted += await deleteExpiredAnnouncements(now)

  console.log(`Cleanup complete: ${deleted} documents deleted`)
})

async function deleteExpiredResolved(collectionName, now) {
  const cutoff = new Date(now.getTime() - AUTO_DELETE_DAYS.resolved * 24 * 60 * 60 * 1000)
  const snap = await db.collection(collectionName)
    .where('resolvedAt', '!=', null)
    .where('resolvedAt', '<=', cutoff)
    .get()

  let count = 0
  for (const doc of snap.docs) {
    const data = doc.data()
    // Storage 사진 삭제
    await deletePhotos(data.photoUrls)
    await doc.ref.delete()
    count++
  }
  return count
}

async function deleteExpiredFoundItems(now) {
  const cutoff = new Date(now.getTime() - AUTO_DELETE_DAYS.resolved * 24 * 60 * 60 * 1000)
  const snap = await db.collection('foundItems')
    .where('resolvedAt', '!=', null)
    .where('resolvedAt', '<=', cutoff)
    .get()

  let count = 0
  for (const doc of snap.docs) {
    const data = doc.data()
    // 서브컬렉션 claims 삭제
    const claimsSnap = await doc.ref.collection('claims').get()
    for (const claim of claimsSnap.docs) {
      await claim.ref.delete()
    }
    // Storage 사진 삭제
    await deletePhotos(data.photoUrls)
    await doc.ref.delete()
    count++
  }
  return count
}

async function deleteUnclaimedFoundItems(now) {
  const cutoff = new Date(now.getTime() - AUTO_DELETE_DAYS.unclaimed * 24 * 60 * 60 * 1000)
  const snap = await db.collection('foundItems')
    .where('status', '==', 'unclaimed')
    .where('createdAt', '<=', cutoff)
    .get()

  let count = 0
  for (const doc of snap.docs) {
    const data = doc.data()
    // 서브컬렉션 claims 삭제
    const claimsSnap = await doc.ref.collection('claims').get()
    for (const claim of claimsSnap.docs) {
      await claim.ref.delete()
    }
    await deletePhotos(data.photoUrls)
    await doc.ref.delete()
    count++
  }
  return count
}

async function deleteExpiredAnnouncements(now) {
  const snap = await db.collection('announcements')
    .where('expiresAt', '<=', now)
    .get()

  let count = 0
  for (const doc of snap.docs) {
    await doc.ref.delete()
    count++
  }
  return count
}

// Storage 사진 삭제 유틸
async function deletePhotos(photoUrls) {
  if (!photoUrls || !photoUrls.length) return
  for (const url of photoUrls) {
    try {
      // Firebase Storage URL에서 파일 경로 추출
      const path = decodeURIComponent(url.split('/o/')[1]?.split('?')[0])
      if (path) {
        await bucket.file(path).delete()
      }
    } catch (err) {
      // 파일 이미 삭제된 경우 무시
      console.warn(`Failed to delete photo: ${err.message}`)
    }
  }
}
