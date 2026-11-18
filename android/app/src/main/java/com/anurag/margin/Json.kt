package com.anurag.margin

import org.json.JSONArray
import org.json.JSONObject

/**
 * Reads JSON the way JSON.parse does: strict RFC 8259 syntax, the last of duplicate keys wins, any nesting
 * depth, and numbers too large for a double read as [Infinite]. org.json's own reader accepts unquoted keys,
 * single quotes, and trailing commas, and its versions differ on duplicate keys and depth.
 */
object StrictJson {
    /** A number JSON.parse reads as Infinity or -Infinity. org.json cannot hold a non-finite number. */
    object Infinite

    /** The value, as JSONObject, JSONArray, String, Long, Double, Boolean, JSONObject.NULL, or [Infinite]; null if not JSON. */
    fun parse(text: String): Any? = try {
        Reader(text).document()
    } catch (_: Malformed) {
        null
    }

    private class Malformed : Exception()

    private class Reader(private val text: String) {
        private var index = 0

        fun document(): Any {
            val containers = ArrayList<Any>()
            val keys = ArrayList<String?>()
            skipSpace()
            while (true) {
                var value: Any = when (peek()) {
                    '{' -> {
                        index += 1
                        skipSpace()
                        if (peek() == '}') {
                            index += 1
                            JSONObject()
                        } else {
                            containers += JSONObject()
                            keys += key()
                            continue
                        }
                    }
                    '[' -> {
                        index += 1
                        skipSpace()
                        if (peek() == ']') {
                            index += 1
                            JSONArray()
                        } else {
                            containers += JSONArray()
                            keys += null
                            continue
                        }
                    }
                    else -> scalar()
                }
                while (true) {
                    skipSpace()
                    if (containers.isEmpty()) {
                        if (index != text.length) throw Malformed()
                        return value
                    }
                    val container = containers.last()
                    if (container is JSONObject) container.put(keys.last()!!, value) else (container as JSONArray).put(value)
                    val next = take()
                    if (next == ',') {
                        skipSpace()
                        if (container is JSONObject) keys[keys.lastIndex] = key()
                        break
                    }
                    val closes = if (container is JSONObject) '}' else ']'
                    if (next != closes) throw Malformed()
                    containers.removeAt(containers.lastIndex)
                    keys.removeAt(keys.lastIndex)
                    value = container
                }
            }
        }

        private fun key(): String {
            if (peek() != '"') throw Malformed()
            val key = string()
            skipSpace()
            if (take() != ':') throw Malformed()
            skipSpace()
            return key
        }

        private fun scalar(): Any = when (peek()) {
            '"' -> string()
            't' -> literal("true", true)
            'f' -> literal("false", false)
            'n' -> literal("null", JSONObject.NULL)
            else -> number()
        }

        private fun literal(word: String, value: Any): Any {
            if (!text.startsWith(word, index)) throw Malformed()
            index += word.length
            return value
        }

        private fun number(): Any {
            val start = index
            if (peek() == '-') index += 1
            when {
                peek() == '0' -> index += 1
                peek() in '1'..'9' -> digits()
                else -> throw Malformed()
            }
            var whole = true
            if (peek() == '.') {
                index += 1
                whole = false
                if (peek() !in '0'..'9') throw Malformed()
                digits()
            }
            if (peek() == 'e' || peek() == 'E') {
                index += 1
                whole = false
                if (peek() == '+' || peek() == '-') index += 1
                if (peek() !in '0'..'9') throw Malformed()
                digits()
            }
            val literal = text.substring(start, index)
            if (whole) literal.toLongOrNull()?.let { return it }
            val number = literal.toDouble()
            return if (number.isInfinite()) Infinite else number
        }

        private fun digits() {
            while (peek() in '0'..'9') index += 1
        }

        private fun string(): String {
            index += 1
            val out = StringBuilder()
            while (true) {
                val char = take()
                when {
                    char == '"' -> return out.toString()
                    char == '\\' -> out.append(escape())
                    char < ' ' -> throw Malformed()
                    else -> out.append(char)
                }
            }
        }

        private fun escape(): Char = when (take()) {
            '"' -> '"'
            '\\' -> '\\'
            '/' -> '/'
            'b' -> '\b'
            'f' -> '\u000C'
            'n' -> '\n'
            'r' -> '\r'
            't' -> '\t'
            'u' -> {
                if (index + 4 > text.length) throw Malformed()
                val hex = text.substring(index, index + 4)
                if (!hex.all { Character.digit(it, 16) >= 0 }) throw Malformed()
                index += 4
                hex.toInt(16).toChar()
            }
            else -> throw Malformed()
        }

        private fun skipSpace() {
            while (index < text.length && text[index] in " \t\n\r") index += 1
        }

        private fun peek(): Char = if (index < text.length) text[index] else END

        private fun take(): Char {
            if (index >= text.length) throw Malformed()
            return text[index++]
        }
    }

    private const val END = '￿'
}
