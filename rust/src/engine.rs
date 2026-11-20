use std::cell::UnsafeCell;

use crate::grid::GridCamera;
use crate::portal::Portal;

pub struct Engine {
    width: f32,
    height: f32,
    mouse_x: f32,
    mouse_y: f32,
    pointer_active: bool,
    time: f32,
    quality_tier: u32,
    slow_frame_accum: f32,
    pub grid: GridCamera,
    pub portal: Portal,
}

struct SyncEngine(UnsafeCell<Engine>);
unsafe impl Sync for SyncEngine {}

static STATE: SyncEngine = SyncEngine(UnsafeCell::new(Engine::new()));

pub fn state() -> &'static mut Engine {
    unsafe { &mut *STATE.0.get() }
}

impl Engine {
    pub const fn new() -> Self {
        Self {
            width: 1280.0,
            height: 720.0,
            mouse_x: -9999.0,
            mouse_y: -9999.0,
            pointer_active: false,
            time: 0.0,
            quality_tier: 0,
            slow_frame_accum: 0.0,
            grid: GridCamera::new(),
            portal: Portal::new(),
        }
    }

    pub fn init(
        &mut self,
        width: f32,
        height: f32,
        portal_enabled: u32,
        rng_seed: u32,
    ) {
        if width.is_finite() {
            self.width = width.clamp(1.0, 16384.0);
        } else {
            self.width = 1280.0;
        }
        if height.is_finite() {
            self.height = height.clamp(1.0, 16384.0);
        } else {
            self.height = 720.0;
        }
        self.pointer_active = false;
        self.quality_tier = 0;
        self.slow_frame_accum = 0.0;

        self.portal.init(portal_enabled != 0, rng_seed);
        self.grid.step_camera(
            0.016,
            1.0,
            self.time,
            self.width,
            self.height,
            self.mouse_x,
            self.mouse_y,
            false,
            true,
        );
        self.portal.step(
            0.0,
            1.0,
            self.time,
            self.width,
            self.height,
            self.mouse_x,
            self.mouse_y,
            false,
            &self.grid,
        );
        self.grid.step_cursor_light(
            0.016,
            self.width,
            self.height,
            self.mouse_x,
            self.mouse_y,
            false,
            None,
            true,
        );
    }

    pub fn resize(&mut self, width: f32, height: f32) {
        if !width.is_finite() || !height.is_finite() {
            return;
        }
        self.width = width.clamp(1.0, 16384.0);
        self.height = height.clamp(1.0, 16384.0);
    }

    pub fn pointer_move(&mut self, x: f32, y: f32) {
        if !x.is_finite() || !y.is_finite() {
            return;
        }
        self.mouse_x = x.clamp(-16384.0, 32768.0);
        self.mouse_y = y.clamp(-16384.0, 32768.0);
        self.pointer_active = true;
    }

    pub fn pointer_leave(&mut self) {
        self.pointer_active = false;
        self.portal.clear_hover();
    }

    pub fn click_portal(&mut self, x: f32, y: f32) -> u32 {
        if !x.is_finite() || !y.is_finite() {
            return 0;
        }
        if self.portal.click(x, y) {
            1
        } else {
            0
        }
    }

    pub fn step(&mut self, dt: f32, motion_scale: f32) -> u32 {
        let raw_dt = if dt.is_finite() { dt } else { 0.016 };
        let safe_dt = raw_dt.clamp(0.0001, 0.1);
        let m_scale = if motion_scale.is_finite() {
            motion_scale.clamp(0.0, 2.0)
        } else {
            0.0
        };
        self.time += safe_dt * m_scale;

        if raw_dt > 0.026 && raw_dt < 0.090 {
            self.slow_frame_accum += raw_dt;
            if self.slow_frame_accum > 1.2 && self.quality_tier == 0 {
                self.quality_tier = 1;
                self.slow_frame_accum = 0.0;
            } else if self.slow_frame_accum > 1.8 && self.quality_tier == 1 {
                self.quality_tier = 2;
            }
        } else if raw_dt <= 0.022 {
            self.slow_frame_accum = (self.slow_frame_accum - raw_dt * 0.5)
                .max(0.0);
        }

        self.grid.step_camera(
            safe_dt,
            m_scale,
            self.time,
            self.width,
            self.height,
            self.mouse_x,
            self.mouse_y,
            self.pointer_active,
            false,
        );
        self.portal.step(
            safe_dt,
            m_scale,
            self.time,
            self.width,
            self.height,
            self.mouse_x,
            self.mouse_y,
            self.pointer_active,
            &self.grid,
        );

        let hovered_anchor = self.portal.hovered_floor_anchor();
        self.grid.step_cursor_light(
            safe_dt,
            self.width,
            self.height,
            self.mouse_x,
            self.mouse_y,
            self.pointer_active,
            hovered_anchor,
            false,
        );

        self.quality_tier
    }
}
