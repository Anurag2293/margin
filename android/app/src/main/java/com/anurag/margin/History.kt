package com.anurag.margin

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

data class HistoryEntry(val key: String, val snapshot: Snapshot, val openedAt: Long)

class History(context: Context) {
    private val file = File(context.filesDir, "history.json")

    fun load(): List<HistoryEntry> {
        if (!file.exists()) return emptyList()
        return try {
            val array = JSONArray(file.readText())
            (0 until array.length()).mapNotNull { index ->
                val item = array.getJSONObject(index)
                val parsed = SnapshotParser.parse(item.getString("json"))
                if (parsed is ParseResult.Ok) {
                    HistoryEntry(item.getString("key"), parsed.snapshot, item.getLong("openedAt"))
                } else null
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun record(snapshot: Snapshot): List<HistoryEntry> {
        if (snapshot.example) return load()
        val key = keyOf(snapshot)
        val entries = listOf(HistoryEntry(key, snapshot, System.currentTimeMillis())) +
            load().filter { it.key != key }
        return save(entries.take(MAX))
    }

    fun remove(key: String): List<HistoryEntry> = save(load().filter { it.key != key })

    fun restore(entry: HistoryEntry): List<HistoryEntry> =
        save((load().filter { it.key != entry.key } + entry).sortedByDescending { it.openedAt })

    private fun save(entries: List<HistoryEntry>): List<HistoryEntry> {
        val array = JSONArray()
        entries.forEach {
            array.put(JSONObject().put("key", it.key).put("openedAt", it.openedAt).put("json", SnapshotJson.canonical(it.snapshot)))
        }
        val temp = File(file.parentFile, "history.json.tmp")
        temp.writeText(array.toString())
        temp.renameTo(file)
        return entries
    }

    private fun keyOf(snapshot: Snapshot): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(SnapshotJson.canonical(snapshot).toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }

    companion object {
        const val MAX = 200
    }
}
