<script lang="ts">
    import CheckmarkImage from "./assets/checkmark.svg";

    interface Props {
        checked: boolean;
        text: string;
        disabled: boolean;
    }

    let { checked = $bindable(), text, disabled }: Props = $props();
</script>

<label class:disabled>
    <div>{text}</div>
    <div class="input">
        <input
            type="checkbox"
            {disabled}
            bind:checked
        />
        <div>
            <img src={CheckmarkImage} />
        </div>
    </div>
</label>

<style lang="scss">
    @use "./Constants.scss" as c;

    label {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 16px;

        &.disabled {
            cursor: not-allowed;

            > div {
                color: c.$color-text-disabled;
            }
        }
    }

    .input {
        position: relative;
        user-select: none;

        display: grid;

        > * {
            width: 26px;
            height: 26px;

            grid-area: 1 / 1 / 1 / 1;
            border-radius: c.$default-border-radius;
        }

        > input {
            appearance: none;
            margin: 0px;
            padding: 0px;

            & + div {
                pointer-events: none;
                background-color: white;
                transition:
                    background-color c.$quick-transition-linear,
                    border-color c.$quick-transition-linear;

                box-sizing: border-box;
                border: 3px solid c.$color-border;

                > img {
                    width: 100%;
                    height: 100%;
                    opacity: 0;

                    transition: opacity c.$quick-transition-linear;
                }
            }

            &:checked + div {
                background-color: c.$color-primary;
                border-color: transparent;

                > img {
                    opacity: 1;
                }
            }

            &:hover {
                & + div {
                    background-color: c.$color-text;
                }

                &:checked + div {
                    background-color: c.$color-primary-hover;
                }

                &:active {
                    & + div {
                        background-color: white;
                    }

                    &:checked + div {
                        background-color: c.$color-primary;
                    }
                }
            }

            &:disabled {
                & + div {
                    background-color: c.$color-text-disabled;
                }

                &:checked + div {
                    background-color: c.$color-primary-disabled;
                }
            }
        }
    }
</style>
