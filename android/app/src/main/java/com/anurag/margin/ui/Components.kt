package com.anurag.margin.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.anurag.margin.Linkify
import com.anurag.margin.TextPart
import com.anurag.margin.parseInstant
import com.anurag.margin.parseJoined
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Base64
import java.util.Locale

@Composable
fun Wordmark() {
    val colors = Margin.colors
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Canvas(Modifier.size(26.dp)) {
            val unit = size.width / 32f
            drawRoundRect(colors.foreground, cornerRadius = CornerRadius(8 * unit))
            drawRoundRect(colors.primary, Offset(10 * unit, 6 * unit), Size(2 * unit, 20 * unit), CornerRadius(unit))
            listOf(10f to 10f, 15f to 10f, 20f to 6f).forEach { (y, w) ->
                drawRoundRect(colors.background, Offset(15 * unit, y * unit), Size(w * unit, 2 * unit), CornerRadius(unit))
            }
        }
        Text("Margin", fontFamily = Serif, fontWeight = FontWeight.Medium, fontSize = 22.sp, color = colors.foreground)
    }
}

private val hues = listOf(32f, 55f, 85f, 140f, 175f, 200f, 300f, 345f)

@Composable
fun Avatar(name: String, handle: String, avatar: String?, size: Dp) {
    val bitmap = remember(avatar) { avatar?.let(::decodeAvatar) }
    if (bitmap != null) {
        Image(
            bitmap = bitmap,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.size(size).clip(CircleShape).background(Margin.colors.muted),
        )
        return
    }
    val hue = hues[(handle.lowercase().fold(0) { h, c -> h * 31 + c.code } and Int.MAX_VALUE) % hues.size]
    val dark = Margin.colors.dark
    val bg = Color.hsl(hue, if (dark) 0.28f else 0.55f, if (dark) 0.28f else 0.84f)
    val fg = Color.hsl(hue, if (dark) 0.55f else 0.45f, if (dark) 0.86f else 0.3f)
    Box(Modifier.size(size).clip(CircleShape).background(bg), contentAlignment = Alignment.Center) {
        Text(initials(name), color = fg, fontWeight = FontWeight.SemiBold, fontSize = (size.value * 0.34f).sp)
    }
}

private fun decodeAvatar(dataUri: String): ImageBitmap? = try {
    val bytes = Base64.getDecoder().decode(dataUri.substringAfter("base64,"))
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    val sample = avatarSampleSize(bounds.outWidth, bounds.outHeight)
    if (sample == 0) null
    else BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
        ?.asImageBitmap()
} catch (_: Exception) {
    null
} catch (_: OutOfMemoryError) {
    null
}

/** Power-of-two sample size that brings an avatar down to at most [target] px a side; 0 rejects it. */
fun avatarSampleSize(width: Int, height: Int, target: Int = 512): Int {
    if (width <= 0 || height <= 0 || width > 16_384 || height > 16_384) return 0
    var sample = 1
    while (width / sample > target || height / sample > target) sample *= 2
    return sample
}

private fun initials(name: String): String {
    val words = name.replace(Regex("[^\\p{L}\\p{N}\\s]"), " ").split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (words.isEmpty()) return "?"
    val first = words.first().codePoints().findFirst().orElse('?'.code)
    val last = if (words.size > 1) words.last().codePoints().findFirst().orElse(0) else 0
    return buildString {
        appendCodePoint(first)
        if (last != 0) appendCodePoint(last)
    }.uppercase()
}

@Composable
fun VerifiedBadge(size: Dp = 16.dp) {
    Icon(
        Icons.Filled.Verified,
        contentDescription = "Verified",
        tint = Margin.colors.primary,
        modifier = Modifier.size(size),
    )
}

@Composable
fun LinkedText(text: String, style: TextStyle, modifier: Modifier = Modifier) {
    val colors = Margin.colors
    val annotated = remember(text, colors) { linkified(text, colors) }
    Text(annotated, style = style, modifier = modifier)
}

private fun linkified(text: String, colors: Palette): AnnotatedString = buildAnnotatedString {
    val linkStyles = TextLinkStyles(
        style = SpanStyle(textDecoration = TextDecoration.Underline, color = colors.foreground),
        pressedStyle = SpanStyle(textDecoration = TextDecoration.Underline, color = colors.primary),
    )
    for (part in Linkify.split(text)) {
        when (part) {
            is TextPart.Plain -> append(part.value)
            is TextPart.Link -> withLink(LinkAnnotation.Url(part.href, linkStyles)) { append(part.value) }
            is TextPart.Blocked -> withStyle(SpanStyle(color = colors.mutedFg, textDecoration = TextDecoration.Underline)) {
                append(part.value)
            }
        }
    }
}

fun Modifier.describe(text: String) = semantics { contentDescription = text }

private val postTime = DateTimeFormatter.ofPattern("MMM d, yyyy, h:mm a", Locale.US)
private val postDate = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US)
private val joinedFormat = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.US)

fun formatPostTime(value: String?, dateOnly: Boolean = false): String {
    val instant = value?.let(::parseInstant) ?: return "Time not included"
    val local = instant.atZoneSameInstant(ZoneId.systemDefault())
    return (if (dateOnly) postDate else postTime).format(local)
}

fun formatJoined(value: String): String {
    val date = parseJoined(value.take(7)) ?: return value
    return joinedFormat.format(date)
}

fun formatCount(value: Long): String {
    fun scaled(divisor: Double, suffix: String): String {
        val number = value / divisor
        val text = if (number >= 100) "%.0f".format(Locale.US, number) else "%.1f".format(Locale.US, number)
        return text.removeSuffix(".0") + suffix
    }
    return when {
        value < 1_000 -> value.toString()
        value < 999_950 -> scaled(1_000.0, "K")
        value < 999_950_000 -> scaled(1_000_000.0, "M")
        else -> scaled(1_000_000_000.0, "B")
    }
}
