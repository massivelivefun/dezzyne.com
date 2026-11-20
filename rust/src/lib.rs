#![deny(unsafe_code)]

mod engine;
mod grid;
mod portal;
mod spring;

#[allow(unsafe_code)]
mod ffi {
    use crate::engine::{with_engine, with_engine_mut};

    #[no_mangle]
    pub extern "C" fn init_scene(
        width: f32,
        height: f32,
        portal_enabled: u32,
        rng_seed: u32,
    ) {
        with_engine_mut(|e| e.init(width, height, portal_enabled, rng_seed));
    }

    #[no_mangle]
    pub extern "C" fn resize_scene(width: f32, height: f32) {
        with_engine_mut(|e| e.resize(width, height));
    }

    #[no_mangle]
    pub extern "C" fn pointer_move(x: f32, y: f32) {
        with_engine_mut(|e| e.pointer_move(x, y));
    }

    #[no_mangle]
    pub extern "C" fn pointer_leave() {
        with_engine_mut(|e| e.pointer_leave());
    }

    #[no_mangle]
    pub extern "C" fn click_portal(x: f32, y: f32) -> u32 {
        with_engine_mut(|e| e.click_portal(x, y))
    }

    #[no_mangle]
    pub extern "C" fn is_portal_hovered() -> u32 {
        with_engine(|e| if e.portal.is_hovered() { 1 } else { 0 })
    }

    #[no_mangle]
    pub extern "C" fn step_scene(dt: f32, motion_scale: f32) -> u32 {
        with_engine_mut(|e| e.step(dt, motion_scale))
    }

    #[no_mangle]
    pub extern "C" fn get_instance_id() -> u32 {
        with_engine(|e| e.portal.instance_id())
    }

    #[no_mangle]
    pub extern "C" fn get_player_count() -> u32 {
        with_engine(|e| e.portal.player_count())
    }

    #[no_mangle]
    pub extern "C" fn get_countdown_sec() -> u32 {
        with_engine(|e| e.portal.countdown_sec())
    }

    #[no_mangle]
    pub extern "C" fn get_camera_ptr() -> *const f32 {
        with_engine(|e| e.grid.as_ptr())
    }

    #[no_mangle]
    pub extern "C" fn get_portal_ptr() -> *const f32 {
        with_engine(|e| e.portal.portal_ptr())
    }

    #[no_mangle]
    pub extern "C" fn get_rings_ptr() -> *const f32 {
        with_engine(|e| e.portal.rings_ptr())
    }

    #[no_mangle]
    pub extern "C" fn get_particles_ptr() -> *const f32 {
        with_engine(|e| e.portal.particles_ptr())
    }

    #[no_mangle]
    pub extern "C" fn get_particle_count() -> usize {
        with_engine(|e| e.portal.particle_count())
    }
}
