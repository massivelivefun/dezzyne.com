use std::cell::RefCell;

use glam::Vec2;

use crate::grid::GridCamera;
use crate::keypad::KeypadProp;
use crate::portal::PortalGroup;

pub const SCENE_PORTALS: u32 = 1;
pub const SCENE_KEYPAD: u32 = 2;

pub struct Engine {
    viewport_size: Vec2,
    pointer_position: Vec2,
    pointer_active: bool,
    elapsed_seconds: f32,
    quality_tier: u32,
    slow_frame_seconds: f32,
    pub grid_camera: GridCamera,
    pub portal_group: PortalGroup,
    pub keypad_prop: KeypadProp,
}

thread_local! {
    static ENGINE: RefCell<Engine> = RefCell::new(Engine::new());
}

pub fn with_engine<R>(callback: impl FnOnce(&Engine) -> R) -> R {
    ENGINE.with(|cell| callback(&cell.borrow()))
}

pub fn with_engine_mut<R>(callback: impl FnOnce(&mut Engine) -> R) -> R {
    ENGINE.with(|cell| callback(&mut cell.borrow_mut()))
}

impl Engine {
    pub fn new() -> Self {
        Self {
            viewport_size: Vec2::new(1280.0, 720.0),
            pointer_position: Vec2::splat(-9999.0),
            pointer_active: false,
            elapsed_seconds: 0.0,
            quality_tier: 0,
            slow_frame_seconds: 0.0,
            grid_camera: GridCamera::new(),
            portal_group: PortalGroup::new(),
            keypad_prop: KeypadProp::new(),
        }
    }

    pub fn initialize(
        &mut self,
        width: f32,
        height: f32,
        scene_mode: u32,
        random_seed: u32,
    ) {
        let clamped_width = if width.is_finite() {
            width.clamp(1.0, 16384.0)
        } else {
            1280.0
        };
        let clamped_height = if height.is_finite() {
            height.clamp(1.0, 16384.0)
        } else {
            720.0
        };
        self.viewport_size = Vec2::new(clamped_width, clamped_height);
        self.pointer_active = false;
        self.quality_tier = 0;
        self.slow_frame_seconds = 0.0;

        self.portal_group
            .initialize_ugce_trio(scene_mode == SCENE_PORTALS, random_seed);
        self.keypad_prop.initialize(scene_mode == SCENE_KEYPAD);

        self.grid_camera.step_camera(
            0.016,
            1.0,
            self.viewport_size,
            self.pointer_position,
            false,
            true,
        );
        self.portal_group.step(
            0.0,
            1.0,
            self.elapsed_seconds,
            self.viewport_size,
            self.pointer_position,
            false,
            &self.grid_camera,
        );
        self.keypad_prop.step(
            0.0,
            1.0,
            self.viewport_size,
            self.pointer_position,
            false,
            &self.grid_camera,
        );
        self.grid_camera.step_cursor_light(
            0.016,
            self.viewport_size,
            self.pointer_position,
            false,
            None,
            true,
        );
    }

    pub fn resize(&mut self, width: f32, height: f32) {
        if !width.is_finite() || !height.is_finite() {
            return;
        }
        self.viewport_size =
            Vec2::new(width.clamp(1.0, 16384.0), height.clamp(1.0, 16384.0));
    }

    pub fn pointer_move(&mut self, pointer_x: f32, pointer_y: f32) {
        if !pointer_x.is_finite() || !pointer_y.is_finite() {
            return;
        }
        self.pointer_position = Vec2::new(
            pointer_x.clamp(-16384.0, 32768.0),
            pointer_y.clamp(-16384.0, 32768.0),
        );
        self.pointer_active = true;
    }

    pub fn pointer_leave(&mut self) {
        self.pointer_active = false;
        self.portal_group.clear_hover();
        self.keypad_prop.clear_hover();
    }

    pub fn click_stage(&mut self, pointer_x: f32, pointer_y: f32) -> i32 {
        if !pointer_x.is_finite() || !pointer_y.is_finite() {
            return -1;
        }
        let pointer_point = Vec2::new(pointer_x, pointer_y);
        if let Some(portal_index) = self.portal_group.click(pointer_point) {
            return portal_index as i32;
        }
        let hit_keypad = self.keypad_prop.click(
            pointer_point,
            self.viewport_size,
            &self.grid_camera,
        );
        if hit_keypad {
            return 0;
        }
        -1
    }

    pub fn is_interactive_hovered(&self) -> bool {
        self.portal_group.is_any_hovered() || self.keypad_prop.is_hovered()
    }

    fn update_quality_tier(&mut self, raw_delta: f32) {
        if raw_delta <= 0.036 {
            self.slow_frame_seconds =
                (self.slow_frame_seconds - raw_delta * 0.5).max(0.0);
            return;
        }
        if raw_delta <= 0.048 || raw_delta >= 0.095 {
            return;
        }
        self.slow_frame_seconds += raw_delta;
        if self.slow_frame_seconds > 1.5 && self.quality_tier == 0 {
            self.quality_tier = 1;
            self.slow_frame_seconds = 0.0;
        }
    }

    pub fn step(
        &mut self,
        delta_seconds: f32,
        motion_scale: f32,
        entities_ready: bool,
    ) -> u32 {
        let raw_delta = if delta_seconds.is_finite() {
            delta_seconds
        } else {
            0.016
        };
        let safe_delta = raw_delta.clamp(0.0001, 0.1);
        let clamped_motion_scale = if motion_scale.is_finite() {
            motion_scale.clamp(0.0, 2.0)
        } else {
            1.0
        };
        self.elapsed_seconds =
            (self.elapsed_seconds + safe_delta * clamped_motion_scale)
                .rem_euclid(36000.0);

        self.update_quality_tier(raw_delta);

        self.grid_camera.step_camera(
            safe_delta,
            clamped_motion_scale,
            self.viewport_size,
            self.pointer_position,
            self.pointer_active,
            false,
        );

        let entity_delta = if entities_ready { safe_delta } else { 0.0 };
        self.portal_group.step(
            entity_delta,
            clamped_motion_scale,
            self.elapsed_seconds,
            self.viewport_size,
            self.pointer_position,
            self.pointer_active && entities_ready,
            &self.grid_camera,
        );
        self.keypad_prop.step(
            entity_delta,
            clamped_motion_scale,
            self.viewport_size,
            self.pointer_position,
            self.pointer_active && entities_ready,
            &self.grid_camera,
        );

        let hovered_anchor = self
            .portal_group
            .hovered_floor_anchor()
            .or_else(|| self.keypad_prop.hovered_floor_anchor());

        self.grid_camera.step_cursor_light(
            safe_delta,
            self.viewport_size,
            self.pointer_position,
            self.pointer_active,
            hovered_anchor,
            false,
        );

        self.quality_tier
    }
}
