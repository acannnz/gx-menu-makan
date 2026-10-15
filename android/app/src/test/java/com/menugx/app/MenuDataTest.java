package com.menugx.app;

import static java.util.Arrays.asList;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Calendar;
import org.json.JSONObject;
import org.junit.BeforeClass;
import org.junit.Test;

/** Memakai menu.json asli (Oktober 2026) dari folder www. */
public class MenuDataTest {

    private static JSONObject months;

    @BeforeClass
    public static void load() throws Exception {
        String json = new String(Files.readAllBytes(Paths.get("../../www/menu.json")), StandardCharsets.UTF_8);
        months = new JSONObject(json).getJSONObject("months");
    }

    private static Calendar at(int month, int day, int hour, int minute) {
        Calendar c = Calendar.getInstance();
        c.clear();
        c.set(2026, month - 1, day, hour, minute);
        return c;
    }

    @Test
    public void pagiDisorotSebelumJam10() {
        MenuData.Content c = MenuData.build(months, at(10, 15, 8, 0));
        assertEquals("Kamis, 15 Okt", c.title);
        assertEquals("Hari ini", c.rel);
        assertTrue(c.meals[0].current);
        assertFalse(c.meals[1].current);
        assertEquals(asList("Tempe Goreng", "Oseng Bakso"), c.meals[0].mains);
        assertEquals(asList("Tumis Toge Ikan Asin"), c.meals[0].sides);
        assertEquals("Nasi Putih", c.meals[0].rice);
        assertFalse(c.meals[0].riceSpecial);
    }

    @Test
    public void siangDisorotJam1230() {
        MenuData.Content c = MenuData.build(months, at(10, 15, 12, 30));
        assertTrue(c.meals[1].current);
        assertEquals(asList("Korean Spicy Chicken"), c.meals[1].mains);
        assertEquals(asList("Kimchi"), c.meals[1].sides);
    }

    @Test
    public void setelahJam20TampilMenuBesok() {
        MenuData.Content c = MenuData.build(months, at(10, 15, 21, 0));
        assertEquals("Jumat, 16 Okt", c.title);
        assertEquals("Besok", c.rel);
        assertTrue(c.meals[0].current);
        assertEquals(asList("Ayam Saus Mentega"), c.meals[0].mains);
    }

    @Test
    public void jenisNasiSpesialDitandai() {
        MenuData.Content c = MenuData.build(months, at(10, 6, 12, 0));
        assertEquals(asList("Kering Tempe Kacang Tanah", "Telur Balado"), c.meals[1].mains);
        assertEquals("Nasi Kuning", c.meals[1].rice);
        assertTrue(c.meals[1].riceSpecial);
        assertEquals(asList("Mie Goreng"), c.meals[1].sides);

        MenuData.Content senin = MenuData.build(months, at(10, 5, 16, 0));
        assertEquals("Nasi Uduk", senin.meals[2].rice);
        assertTrue(senin.meals[2].riceSpecial);
    }

    @Test
    public void menuBesokBelumAdaTetapTampilHariIni() {
        MenuData.Content c = MenuData.build(months, at(10, 31, 21, 0));
        assertEquals("Sabtu, 31 Okt", c.title);
        assertEquals("Hari ini", c.rel);
        assertTrue(c.meals[2].current);
        assertEquals(asList("Tuna Goreng"), c.meals[2].mains);
        assertEquals(asList("Sambel Dabu Dabu", "Lalapan"), c.meals[2].sides);
    }

    @Test
    public void bulanTanpaDataKosong() {
        MenuData.Content c = MenuData.build(months, at(11, 5, 9, 0));
        assertEquals("Kamis, 5 Nov", c.title);
        assertNull(c.meals);
    }

    @Test
    public void jadwalSegarkanBerikutnya() {
        Calendar next = Calendar.getInstance();
        next.setTimeInMillis(MenuData.nextChangeAt(at(10, 15, 9, 30)));
        assertEquals(10, next.get(Calendar.HOUR_OF_DAY));
        assertEquals(15, next.get(Calendar.DAY_OF_MONTH));

        next.setTimeInMillis(MenuData.nextChangeAt(at(10, 15, 22, 0)));
        assertEquals(0, next.get(Calendar.HOUR_OF_DAY));
        assertEquals(16, next.get(Calendar.DAY_OF_MONTH));
    }
}
