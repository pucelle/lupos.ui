import {css, Component, html, RenderResult} from '@pucelle/lupos.js'
import {theme, ThemeSize} from '../style'
import {computed, DOMEvents, effect, EventKeys, immediateWatch} from '@pucelle/ff'
import {ListDataNavigator} from './list-helpers/list-data-navigator'
import {Icon} from './icon'


/** Base type of list item. */
export type ListItem<T> = {
	children?: T[]
}

export interface ListEvents<T extends ListItem<T>> {

	/** 
	 * Fires after selected items changed.
	 * Only available for `selection` mode.
	 */
	select: (selected: ReadonlyArray<T>) => void

	/** 
	 * Fires after navigated item changed.
	 * Only available for `navigation` mode.
	 */
	navigate: (navigated: T) => void

	/** Fires after clicked a list item. */
	click: (clicked: T) => void
}


/** 
 * `<List>` will render data items as a list,
 * and supports sub list.
 * Otherwise it provides single or multiple selection,
 * and direction key navigation.
 */
export class List<T extends ListItem<T> = any, E = {}> extends Component<E & ListEvents<T>> {

	/** Walk item and all descendant items recursively. */
	static *walkItems<T extends ListItem<T>>(item: T): Iterable<T> {
		yield item

		if (item.children) {
			for (let child of item.children) {
				yield* List.walkItems(child)
			}
		}
	}

	static style() {
		let {mainColor, borderColor} = theme

		return css`
		.list{
			display: block;
			border-bottom: 1px solid ${borderColor.alpha(0.4)};
		}
		
		.list-item{
			position: relative;
			display: flex;
			padding-top: 2px;
			padding-bottom: 2px;
			cursor: pointer;
			border-top: 1px solid ${borderColor.alpha(0.4)};

			&:first-child{
				border-top: none;
			}

			&:hover{
				color: ${mainColor};
			}

			&.selected{
				color: ${mainColor};
			}

			&.active{
				color: ${mainColor};

				&::after{
					content: '';
					position: absolute;
					top: 3px;
					bottom: 3px;
					right: 0;
					width: 2px;
					background: ${mainColor.alpha(0.8)};
				}
			}

			&.arrow-selected{
				background-color: ${mainColor.alpha(0.1)};
			}
		}

		.list-toggle-placeholder{
			display: flex;
			width: 1.6em;
			opacity: 0.7;
		}

		.list-icon-placeholder{
			display: flex;
			width: 1.6em;
		}

		.list-text{
			flex: 1;
			min-width: 0;
			padding-right: 4px;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.list-selected-icon{
			margin: 0 0.5em;
		}

		.list-subsection{
			padding-left: 1.6em;
			padding-bottom: 4px;
			overflow: hidden;
			font-size: 0.92em;

			.list-option{
				padding-top: 0;
				padding-bottom: 0;
				border-top: none;
				line-height: calc(1lh - 2px);
			}

			.list-subsection{
				padding-top: 0;
			}

			.list-subsection:not(:last-child){
				padding-bottom: 3px;
				margin-bottom: 3px;
				border-bottom: 1px solid ${borderColor.alpha(0.4)};
			}

			.list-subsection:last-child{
				padding-bottom: 0;
				margin-bottom: 0;
			}
		}
		`
	}


	size: ThemeSize = 'default'

	/** List mode:
	 * - `selection`: provide single item or multiple items selection with a check icon.
	 * - `navigation`: provide single item navigation with a vertical line icon on the right.
	 * Default value is `selection`.
	 */
	mode: 'selection' | 'navigation' = 'selection'

	/** 
	 * Whether each item is selectable, only available for `selection` mode.
	 * Default value is `false`.
	 */
	selectable: boolean = false

	/** 
	 * Whether can select multiple items, only available for `selection` mode.
	 * Default value is `false`.
	 */
	multipleSelect: boolean = false

	/** Input data list. */
	data: T[] = []

	/** Renderer to render each item display content. */
	renderer: (item: T) => RenderResult | string = JSON.stringify

	/** Indicates current select values. */
	selected: T[] = []

	/** Currently expanded items. */
	expanded: T[] = []

	/** 
	 * Latest navigated item for `navigation` mode.
	 * Set this value will make the associated item become visible.
	 */
	navigated: T | null = null

	/** 
	 * If specified, when this element get focus,
	 * you can use keyboard arrow keys to navigate across current list.
	 */
	keyComeFrom: HTMLInputElement | HTMLTextAreaElement | null = null

	/** 
	 * Selected and all parental indices by keyboard navigation.
	 * Only the last index is the truly selected.
	 */
	protected keyNavigator: ListDataNavigator<T> = new ListDataNavigator()

	/** Whether watching keyboard navigation events. */
	private inKeyNavigating: boolean = false

	/** Apply data and expanded to navigator. */
	@effect
	protected applyNavigator() {
		this.keyNavigator.update(this.data, this.expanded)
	}

	protected render() {
		return html`
		<template class="list">
			${this.renderItems(this.data)}
		</template>
		`
	}

	protected renderItems(items: T[]): RenderResult[] {
		let anySiblingsHaveChildren = items.some(item => item.children)

		return items.map((item: T) => {
			return this.renderItem(item, anySiblingsHaveChildren)
		})
	}

	protected renderItem(item: T, anySiblingsHaveChildren: boolean): RenderResult {
		let expanded = this.expanded.includes(item)

		return html`
			<div
				class="list-item"
				:class=${this.renderActiveSelectedClassName(item)}
				:class.arrow-selected=${item === this.keyNavigator.current}
				@click.prevent=${() => this.onClickItem(item)}
			>
				<lu:if ${item.children && item.children.length > 0}>
					<div class='list-toggle-placeholder'
						@click.stop=${() => this.toggleExpanded(item)}
					>
						<Icon .type=${expanded ? 'triangle-down' : 'triangle-right'} />
					</div>
				</lu:if>

				<lu:elseif ${anySiblingsHaveChildren}>
					<div class='list-toggle-placeholder' />
				</lu:elseif>

				<div class="list-text">
					${this.renderer(item)}
				</div>

				<lu:if ${this.isSelected(item)}>
					<Icon class="list-selected-icon" .type="checked" />
				</lu:if>
			</div>

			<lu:if ${item.children && expanded}>
				<div class="list-subsection">${this.renderItems(item.children!)}</div>
			</lu:if>
		`
	}

	protected renderActiveSelectedClassName(item: T) {
		if (this.mode === 'navigation') {
			if (this.navigated === item) {
				return 'active'
			}
		}
		else {
			if (this.isSelected(item)) {
				return 'selected'
			}
		}
		
		return ''
	}

	/** Whether an item has been selected.  */
	protected isSelected(item: T): boolean {
		return this.selected.includes(item)
	}

	/** Toggle expanded state. */
	protected toggleExpanded(item: T) {
		if (this.expanded.includes(item)) {
			this.expanded.splice(this.expanded.indexOf(item), 1)
		}
		else {
			this.expanded.push(item)
		}
	}

	/** Do selection or navigation. */
	protected onClickItem(this: List, item: T) {
		if (this.mode === 'navigation') {
			this.navigated = item
			this.fire('navigate', item)
		}
		else if (this.selectable) {
			if (this.multipleSelect) {
				if (this.selected.includes(item)) {
					this.selected.splice(this.selected.indexOf(item), 1)
				}
				else {
					this.selected.push(item)
				}
			}
			else {
				this.selected = [item]
			}

			this.fire('select', this.selected)
		}

		this.fire('click', item)
	}

	/** On `navigated` property change. */
	@immediateWatch('navigated')
	protected onChangeNavigated() {
		if (this.navigated) {
			this.applyExpandedRecursively(this.data, this.navigated)
		}
	}

	/** 
	 * Make active item been expanded recursively.
	 * Returns whether any of items has expanded descendants.
	  */
	private applyExpandedRecursively(items: T[], active: T): boolean {
		return items.some(item => {
			if (item === active) {
				return true
			}

			if (item.children) {
				let hasActiveChildItem = this.applyExpandedRecursively(item.children, active)
				if (hasActiveChildItem) {
					if (!this.expanded.includes(item)) {
						this.expanded.push(item)
					}
				}
			}

			return false
		})
	}


	private lastKeyComeFrom: HTMLElement | null = null

	/** On `keyComeFrom` property change. */
	@immediateWatch('keyComeFrom')
	protected onKeyComeFromChange(keyComeFrom: HTMLElement | null) {
		if (!keyComeFrom) {
			return
		}

		if (this.lastKeyComeFrom) {
			DOMEvents.off(this.lastKeyComeFrom, 'keydown', this.keyNavigateByEvent as any, this)
			DOMEvents.off(this.lastKeyComeFrom, 'blur', this.onKeyComeFromBlur, this)
		}

		if (keyComeFrom) {
			DOMEvents.on(keyComeFrom, 'keydown', this.keyNavigateByEvent as any, this)
			DOMEvents.on(keyComeFrom, 'blur', this.onKeyComeFromBlur, this)
		}

		this.lastKeyComeFrom = keyComeFrom
	}

	/** Moves arrow selected by a keyboard event. */
	protected keyNavigateByEvent(event: KeyboardEvent) {
		let key = EventKeys.getShortcutKey(event)

		// Active key navigation if not yet.
		if (key === 'ArrowUp' || key === 'ArrowDown') {
			this.inKeyNavigating = true
		}
		
		if (key === 'ArrowUp') {
			this.keyNavigator.moveUp()
		}
		else if (key === 'ArrowDown') {
			this.keyNavigator.moveDown()
		}
		else if (key === 'ArrowLeft') {
			if (this.inKeyNavigating) {
				this.keyNavigator.moveLeft()
			}
		}
		else if (key === 'ArrowRight') {
			if (this.inKeyNavigating) {
				let item = this.keyNavigator.current
				if (item && !this.expanded.includes(item) && item.children) {
					this.toggleExpanded(item)
					this.keyNavigator.moveRight()
				}
			}
		}
		else if (key === 'Enter') {
			if (this.inKeyNavigating) {
				let item = this.keyNavigator.current
				if (item) {
					this.onClickItem(item)
				}
			}
		}
		else if (key === 'Escape') {
			this.inKeyNavigating = false
			this.keyNavigator.clear()
		}
	}

	protected onKeyComeFromBlur() {
		this.inKeyNavigating = false
		this.keyNavigator.clear()
	}
}