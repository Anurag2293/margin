package com.anurag.margin

/** A regex class body for JavaScript's \s, which the web reader uses to split and trim text. Java's \s is ASCII only. */
const val JS_SPACE = "\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"

private val jsSpaceChar = Regex("[$JS_SPACE]")
val jsSpaceRun = Regex("[$JS_SPACE]+")

fun Char.isJsSpace(): Boolean = jsSpaceChar.matches(toString())

/** String.prototype.trim: unlike Kotlin's trim, it removes a BOM and keeps U+001C to U+001F. */
fun String.jsTrim(): String = trim { it.isJsSpace() }
