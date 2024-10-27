import {css, html, Component} from '@pucelle/lupos.js'
import {theme} from '../style'
import {DOMEvents, Aligner, fade, onUpdateComplete} from '@pucelle/ff'
import {Icon} from './icon'


/** 
 * `<Modal>` shows blocking-level content and help to
 * complete a child task on a popup modal.
 * 
 * `:slot="action"` - single action button or action buttons container.
 */
export class Modal<E = {}> extends Component<E> {

	static style() {
		let {textColor, popupBorderRadius, popupShadowBlurRadius, popupBackgroundColor, popupShadowColor} = theme

		return css`
		.modal{
			position: fixed;
			display: flex;
			flex-direction: column;
			z-index: 1000;	// Same with popup
			border-radius: ${popupBorderRadius}px;
			box-shadow: 0 0 ${popupShadowBlurRadius}px ${popupShadowColor};
			background: ${popupBackgroundColor};
			max-width: 100%;
			max-height: 100%;
			padding: 0.6em 1.2em;
			overflow: hidden;
		}

		.modal-mask{
			position: fixed;
			z-index: 1000;
			left: 0;
			top: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.5);
		}

		.modal-header{
			display: flex;
			flex: none;
			font-size: 0.928em;
			padding-bottom: 0.4em;
			border-bottom: 1px solid ${textColor.alpha(0.8)};
			margin-bottom: 0.6em;
		}

		.modal-title{
			flex: 1;
			min-width: 0;
			font-weight: bold;
			overflow: hidden;
			white-space: nowrap;
			text-overflow: ellipsis;
		}

		.modal-close{
			display: flex;
			margin-top: 0;
			margin-right: -0.4em;
			cursor: pointer;

			&:active{
				transform: translateY(1px);
			}
		}

		.modal-actions{
			margin-left: 1.2em;

			.button{
				margin-left: 0.6em;
				font-size: 0.928em;
			}
		}

		.modal-content{
			flex: 1;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow-y: auto;
			margin-right: -1.2em;
			padding-right: 1.2em;
			padding-top: 0.2em;
			padding-bottom: 0.2em;
		}
	`}
	
	/** Mask element. */
	protected maskEl!: HTMLElement

	/** Modal title. */
	title: string = ''

	/** Whether modal opened. */
	opened: boolean = false

	protected render() {
		return html`
			<template tabindex="0" autofocus
				class="modal"
				:transition.immediate=${fade()}
				@transition-leave-ended=${this.onLeaveTransitionEnded}
			>
				<div class="modal-mask"
					:ref=${this.maskEl}
					:transition.immediate.global=${fade()}
				/>

				<div class="modal-header">
					<div class="modal-title">${this.title}</div>

					<lu:if ${this.slotElements.action}>
						<div class="modal-actions">
							<slot name="action" />
						</div>
					</lu:if>

					<lu:if ${!this.slotElements.action}>
						<Icon class="modal-close" .type="close"
							@click=${this.hide}
						/>
					</lu:if>
				</div>

				<div class="modal-content">
					<slot />
				</div>
			</template>
		`
	}

	protected onLeaveTransitionEnded() {
		this.maskEl.remove()
	}

	protected onConnected() {
		super.onConnected()
		
		onUpdateComplete(() => {
			if (this.maskEl && this.el.previousElementSibling !== this.maskEl) {
				this.el.before(this.maskEl)
			}
		})
		
		DOMEvents.on(window, 'resize', this.onWindowResize, this)
	}

	protected onUpdated() {
		this.toCenter()
	}

	protected onDisconnected() {
		DOMEvents.off(window, 'resize', this.onWindowResize, this)
	}

	protected onWindowResize() {
		this.toCenter()
	}

	protected toCenter() {
		new Aligner(this.el, document.documentElement).align({position: 'c'})
	}

	/**
	 * To show the modal, you may `renderComponent` and then call `show()` or append to `body`.
	 * If you want render modal as a child element  and append into document automatically,
	 * just call `show` in `onConnected`.
	 */ 
	show() {
		if (this.opened) {
			return
		}

		this.opened = true
		this.appendTo(document.body)
	}

	hide() {
		if (!this.opened) {
			return
		}

		this.opened = false
		this.remove(true)
	}
}