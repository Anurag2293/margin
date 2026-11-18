package com.anurag.margin

import com.anurag.margin.ui.formatCount
import com.anurag.margin.ui.formatJoined
import org.junit.Assert.assertEquals
import org.junit.Test

/** Ports the values src/components/profile-sheet.dom.test.tsx checks in the profile sheet. */
class ProfileFormatTest {
    @Test
    fun showsCountsAndTheJoinedMonthAsTheWebProfileSheetDoes() {
        assertEquals("12.4K", formatCount(12_400))
        assertEquals("318", formatCount(318))
        assertEquals("1.5M", formatCount(1_500_000))
        assertEquals("March 2014", formatJoined("2014-03"))
        val bio = "Line one\nhttps://example.com/notes and https://x.com/ada"
        assertEquals(listOf("https://example.com/notes"), Linkify.split(bio).filterIsInstance<TextPart.Link>().map { it.href })
    }
}
