use std::cell::RefCell;

use glam::Vec2;

use crate::grid::GridCamera;
use crate::portal::Portal;

pub struct Engine {
    size: Vec2,
    mouse: Vec2,
    pointer_active: bool,
    time: f32,
    quality_tier: u32,
    slow_frame_accum: f32,
    pub grid: GridCamera,
    pub portal: Portal,
}

thread_local! {
    static ENGINE: RefCell<Engine> = RefCell::new(Engine::new());
}

pub fn with_engine<R>(f: impl FnOnce(&Engine) -> R) -> R {
    ENGINE.with(|cell| f(&cell.borrow()))
}

pub fn with_engine_mut<R>(f: impl FnOnce(&mut Engine) -> R) -> R {
    ENGINE.with(|cell| f(&mut cell.borrow_mut()))
}

impl Engine {
    pub fn new() -> Self {
        Self {
            size: Vec2::new(1280.0, 720.0),
            mouse: Vec2::splat(-9999.0),
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
        let w = if width.is_finite() {
            width.clamp(1.0, 16384.0)
        } else {
            1280.0
        };
        let h = if height.is_finite() {
            height.clamp(1.0, 16384.0)
        } else {
            720.0
        };
        self.size = Vec2::new(w, h);
        self.pointer_active = false;
        self.quality_tier = 0;
        self.slow_frame_accum = 0.0;

        self.portal.init(portal_enabled != 0, rng_seed);
        self.grid
            .step_camera(0.016, 1.0, self.size, self.mouse, false, true);
        self.portal.step(
            0.0, 1.0, self.time, self.size, self.mouse, false, &self.grid,
        );
        self.grid.step_cursor_light(
            0.016, self.size, self.mouse, false, None, true,
        );
    }

    pub fn resize(&mut self, width: f32, height: f32) {
        if !width.is_finite() || !height.is_finite() {
            return;
        }
        self.size =
            Vec2::new(width.clamp(1.0, 16384.0), height.clamp(1.0, 16384.0));
    }

    pub fn pointer_move(&mut self, x: f32, y: f32) {
        if !x.is_finite() || !y.is_finite() {
            return;
        }
        self.mouse =
            Vec2::new(x.clamp(-16384.0, 32768.0), y.clamp(-16384.0, 32768.0));
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
        if self.portal.click(Vec2::new(x, y)) {
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
            self.slow_frame_accum =
                (self.slow_frame_accum - raw_dt * 0.5).max(0.0);
        }

        self.grid.step_camera(
            safe_dt,
            m_scale,
            self.size,
            self.mouse,
            self.pointer_active,
            false,
        );
        self.portal.step(
            safe_dt,
            m_scale,
            self.time,
            self.size,
            self.mouse,
            self.pointer_active,
            &self.grid,
        );

        let hovered_anchor = self.portal.hovered_floor_anchor();
        self.grid.step_cursor_light(
            safe_dt,
            self.size,
            self.mouse,
            self.pointer_active,
            hovered_anchor,
            false,
        );

        self.quality_tier
    }
}
